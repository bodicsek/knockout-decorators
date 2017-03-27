import * as ko from "knockout";

const prefix = "__ko_decorators_";

export let PATCHED_KEY: string | symbol = prefix + "patched__";
export let EXTENDERS_KEY: string | symbol = prefix + "extenders__";
export let SUBSCRIPTIONS_KEY: string | symbol = prefix + "subscriptions__";

if (typeof Symbol !== "undefined") {
    PATCHED_KEY = Symbol(PATCHED_KEY);
    EXTENDERS_KEY = Symbol(EXTENDERS_KEY);
    SUBSCRIPTIONS_KEY = Symbol(SUBSCRIPTIONS_KEY);
}

export function defineProperty(instance: Object, key: any, descriptor: PropertyDescriptor) {
    descriptor.configurable = true;
    Object.defineProperty(instance, key, descriptor);
}

export const extendObject = ko.utils.extend;
export const objectForEach = ko.utils.objectForEach;
export const getPrototypeOf = Object.getPrototypeOf.bind(Object);
export const getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor.bind(Object);
export const hasOwnProperty = Function.prototype.call.bind(Object.prototype.hasOwnProperty);
export const arraySlice = Function.prototype.call.bind(Array.prototype.slice);
