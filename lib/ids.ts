import { customAlphabet } from "nanoid";

const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
export const id = customAlphabet(alphabet, 12);
export const slug = customAlphabet(alphabet, 8);
