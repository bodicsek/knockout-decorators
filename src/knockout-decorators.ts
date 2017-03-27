/**
 * Copyright (c) 2016-2017 Dmitry Panyushkin
 * Available under MIT license
 * Version: 0.9.2
 */
import * as ko from "knockout";
import {
    defineProperty, extendObject, getOwnPropertyDescriptor, hasOwnProperty, PATCHED_KEY, SUBSCRIPTIONS_KEY,
} from "./common-functions";
import { defineEventProperty } from "./event-property";
import { defineObservableArray } from "./observable-array";
import { defineObservableProperty } from "./observable-property";
import { applyExtenders, defineExtenders } from "./property-extenders";

/**
 * Property decorator that creates hidden (shallow) ko.observable with ES6 getter and setter for it
 * If initialized by Array then hidden (shallow) ko.observableArray will be created
 */
export function observable(prototype: Object, key: string | symbol) {
    defineProperty(prototype, key, {
        get() {
            throw new Error("@observable property '" + key.toString() + "' was not initialized");
        },
        set(this: Object, value: any) {
            if (Array.isArray(value)) {
                defineObservableArray(this, key, value, false);
            } else {
                defineObservableProperty(this, key, value, false);
            }
        },
    });
}

/*---------------------------------------------------------------------------*/

/**
 * Property decorator that creates hidden (deep) ko.observable with ES6 getter and setter for it
 * If initialized by Array then hidden (deep) ko.observableArray will be created
 */
export function reactive(prototype: Object, key: string | symbol) {
    defineProperty(prototype, key, {
        get() {
            throw new Error("@reactive property '" + key.toString() + "' was not initialized");
        },
        set(this: Object, value: any) {
            if (Array.isArray(value)) {
                defineObservableArray(this, key, value, true);
            } else {
                defineObservableProperty(this, key, value, true);
            }
        },
    });
}

/*---------------------------------------------------------------------------*/

/**
 * Accessor decorator that wraps ES6 getter to hidden ko.pureComputed
 *
 * Setter is not wrapped to hidden ko.pureComputed and stays unchanged
 *
 * But we can still extend getter @computed by extenders like { rateLimit: 500 }
 */
export function computed(prototype: Object, key: string | symbol, desc: PropertyDescriptor) {
    const { get, set } = desc || (desc = getOwnPropertyDescriptor(prototype, key));
    if (!get) {
        throw new Error("@computed property '" + key.toString() + "' has no getter");
    }
    desc.get = function (this: Object) {
        const computed = applyExtenders(this, key, ko.pureComputed(get, this));
        defineProperty(this, key, {
            get: computed,
            // tslint:disable-next-line:object-literal-shorthand
            set: set,
        });
        return computed();
    };
    return desc;
}

/*---------------------------------------------------------------------------*/

/**
 * Property decorator that creates hidden (shallow) ko.observableArray with ES6 getter and setter for it
 */
export function observableArray(prototype: Object, key: string | symbol) {
    defineProperty(prototype, key, {
        get() {
            throw new Error("@observableArray property '" + key.toString() + "' was not initialized");
        },
        set(this: Object, value: any[]) {
            defineObservableArray(this, key, value, false);
        },
    });
}

export interface ObservableArray<T> extends Array<T> {
    replace(oldItem: T, newItem: T): void;

    remove(item: T): T[];
    remove(removeFunction: (item: T) => boolean): T[];

    removeAll(): T[];
    removeAll(items: T[]): T[];

    destroy(item: T): void;
    destroy(destroyFunction: (item: T) => boolean): void;

    destroyAll(): void;
    destroyAll(items: T[]): void;

    subscribe(callback: (val: T[]) => void): KnockoutSubscription;
    subscribe(callback: (val: T[]) => void, callbackTarget: any): KnockoutSubscription;
    subscribe(callback: (val: any[]) => void, callbackTarget: any, event: string): KnockoutSubscription;

    /**
     * Run mutator function that can write to array at some index (`array[index] = value;`)
     * Then notify about observableArray changes
     */
    mutate(mutator: (arrayValue: T[]) => void): void;

    /**
     * Replace value at some index and return old value
     */
    set(index: number, value: T): T;
}

/*---------------------------------------------------------------------------*/

/**
 * Apply extenders to decorated @observable
 */
export function extend(extenders: Object): PropertyDecorator;
/**
 * Apply extenders to decorated @observable
 */
export function extend(extendersFactory: () => Object): PropertyDecorator;
/**
 * Apply extenders to decorated @observable
 * @extendersOrFactory { Object | Function } Knockout extenders definition or factory that produces definition
 */
export function extend(extendersOrFactory: Object | Function) {
    return function (prototype: Object, key: string | symbol) {
        defineExtenders(prototype, key, extendersOrFactory);
    };
}

/*---------------------------------------------------------------------------*/

export interface ComponentConstructor {
    new (
        params?: any,
        element?: Node,
        templateNodes?: Node[],
    ): any;
}

export type ComponentDecorator = (constructor: ComponentConstructor) => void;

export type TemplateConfig = (
    string
    | Node[]
    | DocumentFragment
    | { require: string }
    | { element: string | Node }
);

/**
 * Register Knockout component by decorating ViewModel class
 */
export function component(
    name: string,
    options?: Object,
): ComponentDecorator;
/**
 * Register Knockout component by decorating ViewModel class
 */
export function component(
    name: string,
    template: TemplateConfig,
    options?: Object,
): ComponentDecorator;
/**
 * Register Knockout component by decorating ViewModel class
 */
export function component(
    name: string,
    template: TemplateConfig,
    styles: string | string[],
    options?: Object,
): ComponentDecorator;
/**
 * Register Knockout component by decorating ViewModel class
 * @param name {String} Name of component
 * @param template {Any} Knockout template definition
 * @param styles {Any} Ignored parameter (used for `require()` styles by webpack etc.)
 * @param options {Object} Another options that passed directly to `ko.components.register()`
 */
export function component(
    name: string,
    template?: any,
    styles?: any,
    options?: Object,
) {
    if (options === void 0) {
        if (styles === void 0) {
            if (typeof template === "object"
                && template.constructor === Object
                && !("require" in template)
                && !("element" in template)
            ) {
                options = template;
                template = void 0;
            }
        } else if (typeof styles === "object") {
            options = styles;
            styles = void 0;
        }
    }

    return function (constructor: ComponentConstructor) {
        ko.components.register(name, extendObject({
            viewModel: constructor.length < 2 ? constructor : {
                createViewModel(params: any, {
                    element, templateNodes,
                }: {
                        element: Node, templateNodes: Node[],
                    }) {
                    return new constructor(params, element, templateNodes);
                },
            },
            template: template || "<!---->",
            synchronous: true,
        }, options as Object));
    };
}

/*---------------------------------------------------------------------------*/

/**
 * Like https://github.com/jayphelps/core-decorators.js @autobind but less smart and complex
 * Do NOT use with ES6 inheritance!
 */
export function autobind(prototype: Object, key: string | symbol, desc: PropertyDescriptor) {
    const { value, configurable, enumerable } = desc || (desc = getOwnPropertyDescriptor(prototype, key));
    return {
        // tslint:disable-next-line:object-literal-shorthand
        configurable: configurable,
        // tslint:disable-next-line:object-literal-shorthand
        enumerable: enumerable,
        get(this: Object) {
            if (this === prototype) {
                return value;
            }
            const bound = value.bind(this);
            defineProperty(this, key, {
                value: bound,
            });
            return bound;
        },
    } as PropertyDescriptor;
}

/*---------------------------------------------------------------------------*/

/**
 * Define hidden ko.subscribable, that notifies subscribers when decorated method is invoked
 */
export function event(prototype: Object, key: string | symbol) {
    defineProperty(prototype, key, {
        get(this: Object) {
            return defineEventProperty(this, key);
        },
    });
}

export type EventType = Function & {
    subscribe(callback: Function): KnockoutSubscription;
};

/*---------------------------------------------------------------------------*/

/**
 * Subscribe callback to `@observable` or `@computed` dependency changes or to some `@event` property
 */
export function subscribe<T>(
    dependencyOrEvent: () => T,
    callback: (value: T) => void,
    options?: { once?: boolean, event?: "change" | "beforeChange" },
): KnockoutSubscription;
/**
 * Subscribe callback to `@observableArray` dependency "arrayChange" event
 */
export function subscribe<T>(
    dependency: () => T[],
    callback: (value: {
        status: "added" | "deleted";
        value: T;
        index: number;
    }[]) => void,
    options: { once?: boolean, event: "arrayChange" },
): KnockoutSubscription;
/**
 * Subscribe callback to some `@event` property
 */
export function subscribe<T>(
    event: (arg: T) => void,
    callback: (arg: T) => void,
    options?: { once?: boolean },
): KnockoutSubscription;
/**
 * Subscribe callback to some `@event` property
 */
export function subscribe<T1, T2>(
    event: (arg1: T1, arg2: T2) => void,
    callback: (arg1: T1, arg2: T2) => void,
    options?: { once?: boolean },
): KnockoutSubscription;
/**
 * Subscribe callback to some `@event` property
 */
export function subscribe<T1, T2, T3>(
    event: (arg1: T1, arg2: T2, arg3: T3, ...args: any[]) => void,
    callback: (arg1: T1, arg2: T2, arg3: T3, ...args: any[]) => void,
    options?: { once?: boolean },
): KnockoutSubscription;
/**
 * Subscribe callback to `@observable` or `@computed` dependency changes or to some `@event`
 */
export function subscribe(
    dependencyOrEvent: Function,
    callback: (...args: any[]) => void,
    options?: { once?: boolean, event?: "change" | "beforeChange" | "arrayChange" },
) {
    const once = options && options.once || false;

    if (hasOwnProperty(dependencyOrEvent, "subscribe")) {
        // overload: subscribe to @event property
        const event = dependencyOrEvent as EventType;

        if (once) {
            const subscription = event.subscribe(function () {
                subscription.dispose();
                callback.apply(null, arguments);
            });
            return subscription;
        } else {
            return event.subscribe(callback);
        }
    } else {
        // overload: subscribe to @observable, @reactive or @computed
        const event = options && options.event || "change";

        let handler: (value: any) => void;
        let subscription: KnockoutSubscription;

        if (once) {
            handler = function () {
                subscription.dispose();
                callback.apply(null, arguments);
            };
        } else {
            handler = callback;
        }

        if (event === "arrayChange") {
            const obsArray = dependencyOrEvent() as ObservableArray<any>;

            if (Array.isArray(obsArray) && hasOwnProperty(obsArray, PATCHED_KEY)) {
                subscription = obsArray.subscribe(handler, null, event);
            } else {
                throw new Error("Can not subscribe to 'arrayChange' because dependency is not an 'observableArray'");
            }
        } else {
            const computed = ko.computed(dependencyOrEvent as () => any);

            subscription = computed.subscribe(handler, null, event);

            const originalDispose = subscription.dispose;
            // dispose hidden computed with subscription
            subscription.dispose = function (this: KnockoutSubscription) {
                originalDispose.call(this);
                computed.dispose();
            };
        }
        return subscription;
    }
}

/*---------------------------------------------------------------------------*/

/**
 * Get internal ko.observable() for object property decodated by @observable
 */
export function unwrap(instance: Object, key: string | symbol): any;
/**
 * Get internal ko.observable() for object property decodated by @observable
 */
export function unwrap<T>(instance: Object, key: string | symbol): KnockoutObservable<T>;
/**
 * Get internal ko.observable() for object property decodated by @observable
 */
export function unwrap(instance: Object, key: string | symbol) {
    if (!hasOwnProperty(instance, key)) {
        // invoke getter on instance.__proto__ that defines property on instance
        // tslint:disable-next-line:no-unused-expression
        instance[key];
    }
    return getOwnPropertyDescriptor(instance, key).get;
}

/*---------------------------------------------------------------------------*/
/**
 * Mixin which add `subscribe()` instance method and implement `dispose()` method,
 * that disposes all subscription created by `subscribe()`
 */
export interface Disposable {
    /** Dispose all subscriptions from this class */
    dispose(): void;

    /** Subscribe callback to `@observable` or `@computed` dependency changes or to some `@event` property */
    subscribe<T>(
        dependencyOrEvent: () => T,
        callback: (value: T) => void,
        options?: { once?: boolean, event?: "change" | "beforeChange" },
    ): KnockoutSubscription;
    /** Subscribe callback to `@observableArray` dependency "arrayChange" event */
    subscribe<T>(
        dependency: () => T[],
        callback: (value: {
            status: "added" | "deleted";
            value: T;
            index: number;
        }[]) => void,
        options: { once?: boolean, event: "arrayChange" },
    ): KnockoutSubscription;
    /** Subscribe callback to some `@event` property */
    subscribe<T>(
        event: (arg: T) => void,
        callback: (arg: T) => void,
        options?: { once?: boolean },
    ): KnockoutSubscription;
    /** Subscribe callback to some `@event` property */
    subscribe<T1, T2>(
        event: (arg1: T1, arg2: T2) => void,
        callback: (arg1: T1, arg2: T2) => void,
        options?: { once?: boolean },
    ): KnockoutSubscription;
    /** Subscribe callback to some `@event` property */
    subscribe<T1, T2, T3>(
        event: (arg1: T1, arg2: T2, arg3: T3, ...args: any[]) => void,
        callback: (arg1: T1, arg2: T2, arg3: T3, ...args: any[]) => void,
        options?: { once?: boolean },
    ): KnockoutSubscription;

    /** Get internal ko.observable() for class property decodated by `@observable` */
    unwrap(key: string | symbol): any;
    /** Get internal ko.observable() for class property decodated by `@observable` */
    unwrap<T>(key: string | symbol): KnockoutObservable<T>;
}

/**
 * Mixin which add `subscribe()` instance method and implement `dispose()` method,
 * that disposes all subscription created by `subscribe()`
 * @param Base {Function} Base class to extend
 */
export function Disposable<T extends new (...args: any[]) => {}>(
    // tslint:disable-next-line:variable-name
    Base?: T,
): (new (...args: any[]) => Disposable) & T {
    if (typeof Base === "undefined") {
        Base = class { } as T;
    }
    return class extends Base {
        constructor(...args: any[]) {
            super(...args);
        }

        /** Dispose all subscriptions from this class */
        dispose() {
            const subscriptions: KnockoutSubscription[] = this[SUBSCRIPTIONS_KEY];
            if (subscriptions) {
                subscriptions.forEach((subscription) => {
                    subscription.dispose();
                });
            }
        }

        /** Subscribe callback to `@observable` or `@computed` dependency changes or to some `@event` */
        subscribe() {
            const subscription: KnockoutSubscription = subscribe.apply(null, arguments);
            const subscriptions: KnockoutSubscription[] = this[SUBSCRIPTIONS_KEY] || (this[SUBSCRIPTIONS_KEY] = []);
            subscriptions.push(subscription);
            return subscription;
        }

        /** Get internal ko.observable() for class property decodated by `@observable` */
        unwrap(key: string) {
            return unwrap(this, key);
        }
    };
}
