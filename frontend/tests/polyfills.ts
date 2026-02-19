import { TextDecoder, TextEncoder } from "util";

// Polyfill TextEncoder/TextDecoder for jsdom (required by react-router v7)
Object.assign(global, { TextEncoder, TextDecoder });
