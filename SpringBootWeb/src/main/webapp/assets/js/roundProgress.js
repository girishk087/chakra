    'use strict';

        angular.module('angular-svg-round-progressbar', []);

        angular.module('angular-svg-round-progressbar').constant('roundProgressConfig', {
            max:            100,
            semi:           false,
            rounded:        false,
            responsive:     false,
            clockwise:      true,
            radius:         100,
            color:          '#45ccce',
            bgcolor:        '#eaeaea',
            stroke:         5,
            duration:       800,
            animation:      'easeOutCubic',
            animationDelay: 0,
            offset:         0
        });


        angular.module('angular-svg-round-progressbar').service('roundProgressService', ['$window', function($window){
            var service = {};
            var isNumber = angular.isNumber;
            var base = document.head.querySelector('base');

            // credits to http://modernizr.com/ for the feature test
            service.isSupported = !!(document.createElementNS && document.createElementNS('http://www.w3.org/2000/svg', "svg").createSVGRect);

            // fixes issues if the document has a <base> element
            service.resolveColor = base && base.href ? function(value){
                var hashIndex = value.indexOf('#');

                if(hashIndex > -1 && value.indexOf('url') > -1){
                    return value.slice(0, hashIndex) + window.location.href + value.slice(hashIndex);
                }

                return value;
            } : function(value){
                return value;
            };

            // deals with floats passed as strings
            service.toNumber = function(value){
                return isNumber(value) ? value : parseFloat((value + '').replace(',', '.'));
            };

            service.getOffset = function(element, options){
                var value = +options.offset || 0;

                if(options.offset === 'inherit'){
                    var parent = element;
                    var parentScope;

                    while(!parent.hasClass('round-progress-wrapper')){
                        if(service.isDirective(parent)){
                            parentScope = parent.scope().$parent.getOptions();
                            value += ((+parentScope.offset || 0) + (+parentScope.stroke || 0));
                        }

                        parent = parent.parent();
                    }
                }

                return value;
            };

            service.getTimestamp = ($window.performance && $window.performance.now && angular.isNumber($window.performance.now())) ? function(){
                return $window.performance.now();
            } : function(){
                return new $window.Date().getTime();
            };


            service.updateState = function(current, total, pathRadius, element, elementRadius, isSemicircle) {
                if(!elementRadius) return element;

                var value       = current > 0 ? Math.min(current, total) : 0;
                var type        = isSemicircle ? 180 : 359.9999;
                var perc        = total === 0 ? 0 : (value / total) * type;
                var start       = polarToCartesian(elementRadius, elementRadius, pathRadius, perc);
                var end         = polarToCartesian(elementRadius, elementRadius, pathRadius, 0);
                    var arcSweep    = (perc <= 180 ? 0 : 1);
                var d           = 'M ' + start + ' A ' + pathRadius + ' ' + pathRadius + ' 0 ' + arcSweep + ' 0 ' + end;

                return element.attr('d', d);
            };

            service.isDirective = function(el){
                if(el && el.length){
                    var directiveName = 'round-progress';
                    return (typeof el.attr(directiveName) !== 'undefined' || el[0].nodeName.toLowerCase() === directiveName);
                }

                return false;
            };

            service.animations = {
                easeOutCubic: function (t, b, c, d) {
                    return c*((t=t/d-1)*t*t + 1) + b;
                }


            };

            function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
                var angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
                var x = centerX + (radius * Math.cos(angleInRadians));
                var y = centerY + (radius * Math.sin(angleInRadians));

                return x + ' ' + y;
            }

            return service;
        }]);

    

        angular.module('angular-svg-round-progressbar').directive('roundProgress', ['$window', 'roundProgressService', 'roundProgressConfig', function($window, service, roundProgressConfig){
            var base = {
                restrict: 'EA',
                replace: true,
                transclude: true,
                scope: {
                    current:        '=',
                    max:            '=',
                    semi:           '=',
                    rounded:        '=',
                    clockwise:      '=',
                    responsive:     '=',
                    onRender:       '=',
                    radius:         '@',
                    color:          '@',
                    bgcolor:        '@',
                    stroke:         '@',
                    duration:       '@',
                    animation:      '@',
                    offset:         '@',
                    animationDelay: '@'
                }
            };

            return angular.extend(base, {
                link: function(scope, element){
                    var isNested    = !element.hasClass('round-progress-wrapper');
                    var svg         = isNested ? element : element.find('svg').eq(0);
                    var ring        = svg.find('path').eq(0);
                    var background  = svg.find('circle').eq(0);
                    var options     = angular.copy(roundProgressConfig);
                    var lastAnimationId = 0;
                    var lastTimeoutId;
                    var parentChangedListener;

                    scope.getOptions = function(){
                        return options;
                    };

                    var renderCircle = function(){
                        var isSemicircle     = options.semi;
                        var responsive       = options.responsive;
                        var radius           = +options.radius || 0;
                        var stroke           = +options.stroke;
                        var diameter         = radius*2;
                        var backgroundSize   = radius - (stroke/2) - service.getOffset(element, options);

                        svg.css({
                            top:          0,
                            left:         0,
                            position:     responsive ? 'absolute' : 'static',
                            width:        responsive ? '100%' : (diameter + 'px'),
                            height:       responsive ? '100%' : (isSemicircle ? radius : diameter) + 'px',
                            overflow:     'hidden' // on some browsers the background overflows, if in semicircle mode
                        });

                        // when nested, the element shouldn't define its own viewBox
                        if(!isNested){
                            // note that we can't use .attr, because if jQuery is loaded,
                            // it lowercases all attributes and viewBox is case-sensitive
                            svg[0].setAttribute('viewBox', '0 0 ' + diameter + ' ' + (isSemicircle ? radius : diameter));
                        }

                        element.css({
                            width:           responsive ? '100%' : 'auto',
                            position:        'relative',
                            paddingBottom:   responsive ? (isSemicircle ? '50%' : '100%') : 0
                        });

                        ring.css({
                            stroke:          service.resolveColor(options.color),
                            strokeWidth:     stroke,
                            strokeLinecap:   options.rounded ? 'round': 'butt'
                        });

                        if(isSemicircle){
                            ring.attr('transform', options.clockwise ? 'translate(0, ' + diameter + ') rotate(-90)' : 'translate(' + diameter + ', '+ diameter +') rotate(90) scale(-1, 1)');
                        }else{
                            ring.attr('transform', options.clockwise ? '' : 'scale(-1, 1) translate(' + (-diameter) + ' 0)');
                        }

                        background.attr({
                            cx:           radius,
                            cy:           radius,
                            r:            backgroundSize >= 0 ? backgroundSize : 0
                        }).css({
                            stroke:       service.resolveColor(options.bgcolor),
                            strokeWidth:  stroke
                        });
                    };

                    var renderState = function(newValue, oldValue, preventAnimationOverride){
                        var max                 = service.toNumber(options.max || 0);
                        var end                 = newValue > 0 ? $window.Math.min(newValue, max) : 0;
                        var start               = (oldValue === end || oldValue < 0) ? 0 : (oldValue || 0); // fixes the initial animation
                        var changeInValue       = end - start;

                        var easingAnimation     = service.animations[options.animation];
                        var duration            = +options.duration || 0;
                        var preventAnimation    = preventAnimationOverride || (newValue > max && oldValue > max) || (newValue < 0 && oldValue < 0) || duration < 25;

                        var radius              = service.toNumber(options.radius);
                        var circleSize          = radius - (options.stroke/2) - service.getOffset(element, options);
                        var isSemicircle        = options.semi;

                        var doAnimation = function(){
                            // stops some expensive animating if the value is above the max or under 0
                            if(preventAnimation){
                                service.updateState(end, max, circleSize, ring, radius, isSemicircle);

                                if(options.onRender){
                                    options.onRender(end, options, element);
                                }
                            }else{
                                var startTime = service.getTimestamp();
                                var id = ++lastAnimationId;

                                $window.requestAnimationFrame(function animation(){
                                    var currentTime = $window.Math.min(service.getTimestamp() - startTime, duration);
                                    var animateTo = easingAnimation(currentTime, start, changeInValue, duration);

                                    service.updateState(animateTo, max, circleSize, ring, radius, isSemicircle);

                                    if(options.onRender){
                                        options.onRender(animateTo, options, element);
                                    }

                                    if(id === lastAnimationId && currentTime < duration){
                                        $window.requestAnimationFrame(animation);
                                    }
                                });
                            }
                        };

                        if(options.animationDelay > 0){
                            $window.clearTimeout(lastTimeoutId);
                            $window.setTimeout(doAnimation, options.animationDelay);
                        }else{
                            doAnimation();
                        }
                    };

                    var keys = Object.keys(base.scope).filter(function(key){
                        return key;
                    });


                    // properties that are used only for presentation
                    scope.$watchGroup(keys, function(newValue){

                        for(var i = 0; i < newValue.length; i++){
                            if(typeof newValue[i] !== 'undefined'){
                                options[keys[i]] = newValue[i];
                            }

                        }

                        renderCircle();
                        scope.$broadcast('$parentOffsetChanged');

                        // it doesn't have to listen for changes on the parent unless it inherits
                        if(options.offset === 'inherit' && !parentChangedListener){
                            parentChangedListener = scope.$on('$parentOffsetChanged', function(){
                                renderState(scope.current, scope.current, true);
                                renderCircle();
                            });
                        }else if(options.offset !== 'inherit' && parentChangedListener){
                            parentChangedListener();
                        }
                    });

                    // properties that are used during animation. some of these overlap with
                    // the ones that are used for presentation
                    scope.$watchGroup(['current', 'max', 'radius', 'stroke', 'semi', 'offset'], function(newValue, oldValue){
                        renderState(service.toNumber(newValue[0]), service.toNumber(oldValue[0]));
                    });
                },
                template: function(element){
                    var parent = element.parent();
                    var directiveName = 'round-progress';
                    var template = [
                    '<svg class="'+ directiveName +'" xmlns="http://www.w3.org/2000/svg">',
                    '<circle fill="none"/>',
                    '<path fill="none"/>',
                    '<g ng-transclude></g>',
                    '</svg>'
                    ];

                    while(parent.length && !service.isDirective(parent)){
                        parent = parent.parent();
                    }

                    if(!parent || !parent.length){
                        template.unshift('<div class="round-progress-wrapper">');
                        template.push('</div>');
                    }

                    return template.join('\n');
                }
            });
        }]);
