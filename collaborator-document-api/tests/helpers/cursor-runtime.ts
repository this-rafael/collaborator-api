import {ManualClock} from "./discovery-runtime.js";

export {ManualClock};

export const cursorSecret = "0123456789abcdef0123456789abcdef";
export const cursorClock = () => new ManualClock(new Date("2026-07-29T12:00:00.000Z"));
