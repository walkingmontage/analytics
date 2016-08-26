/**
 * author: lin.zhusong
 * date: 2015/11/25
 * version: 1.0.3
 * browser support: IE9+ Firefox 4+ Safari 3+ Chrome * Opera *
 *
 * 使用说明：
 * 1. 在head里尽可能前面引用如下代码
 *    <script>window.__timing_start = Date.now();window.__pid = '0123456789';</script>
 *    <script src="http://xxxx/mm_analytics.js" async></script>
 *    @__timing_start 计时需要
 *    @__lid 项目id
 * 2. 给需要统计的DOM元素，添加属性 wa="the-unique-id"
 *    the-unique-id 为当前节点的埋点id，方便查询使用，同一个页面避免重复
 * 3. 统计的方法为全局对象 window.WA，并有多个可使用的方法
 *    WA.url                         发送统计的url
 *    WA.static_params               统计需要的固定参数
 *    WA.getCookie(name)             取cookie
 *    WA.query(obj, ...)             参数转换为string格式的方法
 *    WA.sendEvent(event, data, boolean)     手动发送统计的方法
 *    @event 点击事件的event，如果没有，请传null
 *    @data 需要发送的数据，注意{cxp: 埋点id}，这个参数为必填
 *
 *    Version 2.0
 *    1. 修改发送统计的方式为 ajax post cors
 *    2. 第一次自动发送所有固定的参数， 此后就只会发送 lid
 */

;(function (win) {
    try{
        var __timing_start = __timing_start || Date.now(),
            lucky = Math.floor(Math.random() * 100) === 10,

        //是否支持performace
            performanceSupported = window.performance && window.performance.timing,
            _timing = performanceSupported ? window.performance.timing : {},

        //https://github.com/ded/domready
            domready = (function () {
                var fns = [], listener
                    , doc = document
                    , hack = doc.documentElement.doScroll
                    , domContentLoaded = 'DOMContentLoaded'
                    , loaded = (hack ? /^loaded|^c/ : /^loaded|^i|^c/).test(doc.readyState)


                if (!loaded)
                    doc.addEventListener(domContentLoaded, listener = function () {
                        doc.removeEventListener(domContentLoaded, listener)
                        loaded = 1
                        while (listener = fns.shift()) listener()
                    })

                return function (fn) {
                    loaded ? setTimeout(fn, 0) : fns.push(fn)
                }
            })(),

            href = win.location.href,

        //动态参数，仅供参考用
            wa_events_dynamic = [
                //事件类型
                //1（页面加载事件）、2（页面内事件）、3（页面关闭事件）
                'et',

                //用户动作类型
                // 1（click）、
                // 2（submit 可能会因为发跳转来不及请求）、
                // 3(change )、
                // 4（focus）、
                // 5（touch保留字段值，暂时不统计）、
                // 6（press key 保留字段值-暂时不统计），如果不好区分就填click
                'at',

                //点击的url
                //仅当et=2（页面内事件）且at=1（点击）时存在
                'cu',

                //点击位置横坐标
                //仅当et=2（页面内事件）且at=1（点击）时存在
                'cx',

                //点击位置纵坐标
                //仅当et=2（页面内事件）且at=1（点击）时存在
                'cy',

                //点击元素的id,目前不考虑空白区域
                //仅当et=2（页面内事件）且at=1（点击）时存在(eid)
                'cxp'
            ];




        win.WA = win.WA || {};

        /**
         * WA方法
         */

        WA.utils = {
            isPlainObject: function(obj) {
                return obj != null && typeof obj === 'object' && obj !== win && Object.getPrototypeOf(obj) == Object.prototype
            }
        }

        /**
         * WA全局属性，即统计的url
         */

         WA.url = 'https://api-log.immomo.com/v1/log/common/web';


        /**
         * WA全局方法， 获取某个cookie
         * @param name
         * @returns value或null
         */
        WA.getCookie = function(name) {
            if (!name) {
                return null;
            }
            return decodeURIComponent(document.cookie.replace(new RegExp("(?:(?:^|.*;)\\s*" + encodeURIComponent(name).replace(/[\-\.\+\*]/g, "\\$&") + "\\s*\\=\\s*([^;]*).*$)|^.*$"), "$1")) || null;
        }

        /**
         * 全局对象，固定的参数，每次发送都需要
         * 可以通过WA.sendEvent的第二个参数设置
         */
        WA.static_params = {
            //业务id
            //获取网址： http://wwww.xxx.com/xxxx
            pid: window.__pid || '',

            //日志行ID字符串，唯一，表示一次展现
            //hash(时间戳  + 随机数(5) + cookie用户标识 )
            lid: (function(){
                var xxid = WA.getCookie('xxxid') || '';
                return Date.now() + '-' + Math.floor(Math.random() * 90000 + 10000) + '-' + xxid
            })(),

            //用户当前打开或关闭页面的url
            // pu: href,

            //用户当前打开或关闭页面的refer
            ru: document.referrer || '',

            //设备类型 int
            //1（PC）、2（PAD）、3（手机）获取不到(-1)
            //dvt:
            //浏览器名称
            //user_agent具体的浏览器就行（无则-1）
            //bsn:

            //屏幕分辨率
            cds: (function(){
                return [win.screen.width, win.screen.height].join('x')
            })(),


            //自定义扩展
            ext: {
                __aid: window.__aid || ''
            }
        }

        var extend = function (target, source, deep) {
            for (key in source)
              if (deep && (WA.utils.isPlainObject(source[key]))) {
                if (WA.utils.isPlainObject(source[key]) && !WA.utils.isPlainObject(target[key]))
                  target[key] = {}
                  extend(target[key], source[key], deep)
              }
              else if (source[key] !== undefined) target[key] = source[key]
         }

        /**
         * WA全局方法，解析参数
         * @param 接受一个或多个JSON
         * @returns key=encodeURIComponent(value)的数组
         */
        WA.query = function(){
            var args = Array.prototype.slice.call(arguments),
                i = 0,
                j = 0,
                len = args.length,
                data = {},
                query = [];

            args.forEach(function(arg){ extend(data, arg, true) })

            for (var j in data) {
                if (data.hasOwnProperty(j)) {
                    var val = WA.utils.isPlainObject(data[j]) ? JSON.stringify(data[j]) : data[j];
                    query.push(j + '=' + encodeURIComponent(val))
                }
            }

            return query;
        }

        var postRequest = function(o){
            var xhr = new XMLHttpRequest();
            xhr.withCredentials = true;
            xhr.onreadystatechange = function(){}
            xhr.open('POST', o.url)
            xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded')
            xhr.send(o.data)
        }

        // 这里采用xhr + rocs的方式发送统计
        // 如果需要用图片的方式：
        // var postRequest = function(o){
        //     var rnd = Date.now(),
        //         n = "log__" + rnd,
        //         c = win[n] = new Image(),
        //         fullUrl = o.url + '?' + o.data + '&rnd=' + rnd;
        //
        //     c.onload = (c.onerror = function () {
        //         win[n] = null;
        //     });
        //
        //     c.src = fullUrl;
        //     c = null;
        // }


        /**
         * WA全局方法 sendEvent
         * @param param 接受event 或 JSON
         * @param doNotConcat  boolean，是否发送固定参数（即增加WA.static_params包含的所有参数一起发送）
         */
        WA.sendEvent = function(event, param, isErr, isInit){

            //抽取1/100发送
            if(!lucky){
                return
            }

            var params;
            if(event && typeof event === 'object'){

                var cxp, ext;

                //event
                if(event.type === 'click'){
                    cxp = event.target.getAttribute('wa');
                }

                if(WA.utils.isPlainObject(param)){
                    cxp = cxp || param.cxp;
                    ext = param.ext;
                }

                if(!cxp){
                    return false;
                }

                params = {
                    et: 2,
                    at: 1,
                    cx: event.pageX,
                    cy: event.pageY,
                    cu: event.target.getAttribute('href') || '',
                    cxp: cxp,
                    ext: ext || {}
                }
            }else{
                params = param
            }


            if(params){
                var data = {
                    environment: {
                        uri: href
                    },

                    logs: !isInit ? {
                        lid: WA.static_params.lid
                    } : {}
                }


                //error
                if(isErr){
                    data.error = params

                //normal
                }else{
                    extend(data.logs, params, true)
                }

                var query = WA.query({
                    log: data
                }).join('&')

                postRequest({
                    url:  WA.url,
                    data: query
                })

            }
        }


        //先把所有的基本参数发过去
        WA.sendEvent(null, WA.static_params, false, true)

        /********    添加统计事件   **********/
        //1. on error
        window.addEventListener('error', function(e){
            if(e){
                WA.sendEvent(null, {
                    file: e.filename || '',
                    msg: e.message || '',
                    pos: [e.lineno || 0, e.colno || 0].join('-')
                }, true)
            }

            return true;
        }, false)

        //2. dom reay
        domready(function(){

            //计算domready时间
            var __ending = Date.now(),
                readyTime;

            if(performanceSupported){
                readyTime = _timing.domContentLoadedEventStart  - _timing.fetchStart || 1;
            }else{
                readyTime =  __ending - __timing_start;
            }

            //绑定统计事件
            //on page loading

            WA.sendEvent(null, {
                et: 1,
                ext: {dr: readyTime}
            })
        })


        //3. click
        //当点击具有wa属性的节点时触发
        if(document){
            document.addEventListener('click', function(e){
                try{
                    var target = e.target;

                    //过滤document
                    //过滤body
                    //向上冒泡查找属性为wa的节点
                    //冒泡4级， 即在点击的元素向上查找4级 任意一级添加wa都生效
                    var level = 0;
                    while(level < 4 && target !== document && target !== document.body && !target.getAttribute('wa') && target.parentNode){
                        target = target.parentNode;
                        level ++;
                    }

                    level = null;

                    if(target.getAttribute){
                        var k = target.getAttribute('wa');
                        if(k){
                            //这里不能传event, 因为target已改变
                            WA.sendEvent(null, {
                                et: 2,
                                at: 1,
                                cxp: k,
                                cu: target.getAttribute('href') || '',
                                cx: e.pageX,
                                cy: e.pageY
                            });
                        }
                    }
                }catch(e){}

            }, false);
        }

        //todo 关于丢数据：刷新或关闭时统计请求被中断。解决方法：window.name或本地存储
        //4. page closed
        //不要用onbeforeunload事情，刷新、下载时都会触发
        window.addEventListener('unload', function(){
            WA.sendEvent(null, {
                et: 3
            });
        }, false)

    }catch(e){}
})(window);
