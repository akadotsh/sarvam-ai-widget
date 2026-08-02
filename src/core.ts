import { asciiBytes, Cmd, type Cmd as Command } from "@native-sdk/core";
import { applyTextInputEvent, type TextEditState, type TextInputEvent } from "@native-sdk/core/text";

type Target = "hindi" | "tamil" | "telugu" | "english";
type Tone = "formal" | "modern" | "classic" | "code_mixed";

export interface Model {
  readonly apiKeyDraft: TextEditState;
  readonly apiKeyText: Uint8Array;
  readonly inputDraft: TextEditState;
  readonly inputText: Uint8Array;
  readonly output: Uint8Array;
  readonly target: Target;
  readonly tone: Tone;
  readonly nativeNumerals: boolean;
  readonly configured: boolean;
  readonly checkingKey: boolean;
  readonly savingKey: boolean;
  readonly loading: boolean;
  readonly failed: boolean;
}

export type Msg =
  | { readonly kind: "api_key_edit"; readonly edit: TextInputEvent }
  | { readonly kind: "input_edit"; readonly edit: TextInputEvent }
  | { readonly kind: "configure_api_key" }
  | { readonly kind: "change_api_key" }
  | { readonly kind: "translate" }
  | { readonly kind: "set_hindi" }
  | { readonly kind: "set_tamil" }
  | { readonly kind: "set_telugu" }
  | { readonly kind: "set_english" }
  | { readonly kind: "set_formal" }
  | { readonly kind: "set_modern" }
  | { readonly kind: "set_classic" }
  | { readonly kind: "set_code_mixed" }
  | { readonly kind: "set_native_numerals" }
  | { readonly kind: "set_international_numerals" }
  | { readonly kind: "key_loaded"; readonly code: number; readonly output: Uint8Array }
  | { readonly kind: "key_load_failed"; readonly reason: Uint8Array }
  | { readonly kind: "key_saved"; readonly code: number; readonly output: Uint8Array }
  | { readonly kind: "key_save_failed"; readonly reason: Uint8Array }
  | { readonly kind: "translated"; readonly status: number; readonly body: Uint8Array }
  | { readonly kind: "translate_failed"; readonly reason: Uint8Array }
  | { readonly kind: "open_widget" }
  | { readonly kind: "quit" };

export const viewUnbound = ["apiKeyDraft", "inputDraft", "target", "checkingKey", "savingKey", "loading", "failed", "key_loaded", "key_load_failed", "key_saved", "key_save_failed", "translated", "translate_failed", "open_widget", "quit"] as const;

const security = asciiBytes("/usr/bin/security");
const service = asciiBytes("dev.native_sdk.sarvam-translate");
const account = asciiBytes("sarvam-api-key");
const defaultInput = asciiBytes("Hey, talk like you normally do. Kal office mein 3 meetings thi and salary 45000 credit ho gayi.");

function editor(text: Uint8Array): TextEditState {
  return { text, selection: { anchor: text.length, focus: text.length }, composition: null };
}

export function initialModel(): [Model, Command<Msg>] {
  return [
    { apiKeyDraft: editor(new Uint8Array(0)), apiKeyText: new Uint8Array(0), inputDraft: editor(defaultInput), inputText: defaultInput, output: new Uint8Array(0), target: "hindi", tone: "formal", nativeNumerals: true, configured: false, checkingKey: true, savingKey: false, loading: false, failed: false },
    Cmd.spawn([security, asciiBytes("find-generic-password"), asciiBytes("-s"), service, asciiBytes("-a"), account, asciiBytes("-w")], { key: "load-key", collect: true, exit: "key_loaded", err: "key_load_failed" }),
  ];
}

export function targetLabel(model: Model): Uint8Array {
  if (model.target === "hindi") return asciiBytes("Hindi");
  if (model.target === "tamil") return asciiBytes("Tamil");
  if (model.target === "telugu") return asciiBytes("Telugu");
  return asciiBytes("English");
}
export function status(model: Model): Uint8Array {
  if (model.loading) return asciiBytes("Translating with Sarvam AI...");
  if (model.failed) return asciiBytes("Could not translate. Check your key and try again.");
  if (model.output.length === 0) return asciiBytes("Your translation will appear here.");
  return asciiBytes("Translation ready.");
}

export function commandMsg(name: string): Msg | null {
  if (name === "sarvam.open") return { kind: "open_widget" };
  if (name === "sarvam.quit") return { kind: "quit" };
  return null;
}

export function update(model: Model, msg: Msg): Model | [Model, Command<Msg>] {
  switch (msg.kind) {
    case "api_key_edit": {
      const draft = applyTextInputEvent(model.apiKeyDraft, msg.edit, 256) ?? model.apiKeyDraft;
      return { ...model, apiKeyDraft: draft, apiKeyText: draft.text, failed: false };
    }
    case "input_edit": {
      const draft = applyTextInputEvent(model.inputDraft, msg.edit, 4000) ?? model.inputDraft;
      return { ...model, inputDraft: draft, inputText: draft.text, failed: false };
    }
    case "change_api_key": return { ...model, configured: false, failed: false };
    case "set_hindi": return { ...model, target: "hindi" };
    case "set_tamil": return { ...model, target: "tamil" };
    case "set_telugu": return { ...model, target: "telugu" };
    case "set_english": return { ...model, target: "english" };
    case "set_formal": return { ...model, tone: "formal" };
    case "set_modern": return { ...model, tone: "modern" };
    case "set_classic": return { ...model, tone: "classic" };
    case "set_code_mixed": return { ...model, tone: "code_mixed" };
    case "set_native_numerals": return { ...model, nativeNumerals: true };
    case "set_international_numerals": return { ...model, nativeNumerals: false };
    case "configure_api_key": {
      if (model.apiKeyText.length === 0) return { ...model, failed: true };
      const next: Model = { ...model, savingKey: true, failed: false };
      return [next, Cmd.spawn([security, asciiBytes("add-generic-password"), asciiBytes("-U"), asciiBytes("-s"), service, asciiBytes("-a"), account, asciiBytes("-w")], { key: "save-key", stdin: model.apiKeyText, collect: true, exit: "key_saved", err: "key_save_failed" })];
    }
    case "key_loaded": {
      if (msg.code !== 0 || msg.output.length === 0) return { ...model, checkingKey: false };
      return { ...model, apiKeyDraft: editor(msg.output.trim()), apiKeyText: msg.output.trim(), configured: true, checkingKey: false };
    }
    case "key_load_failed": return { ...model, checkingKey: false };
    case "key_saved": return { ...model, savingKey: false, configured: msg.code === 0, failed: msg.code !== 0 };
    case "key_save_failed": return { ...model, savingKey: false, failed: true };
    case "translate": {
      if (model.apiKeyText.length === 0 || model.inputText.length === 0) return { ...model, failed: true, output: asciiBytes("Enter your Sarvam API key and text to translate.") };
      const next: Model = { ...model, loading: true, failed: false, output: new Uint8Array(0) };
      return [next, Cmd.fetch({ url: asciiBytes("https://api.sarvam.ai/translate"), method: "POST", headers: { "api-subscription-key": model.apiKeyText, "content-type": "application/json" }, body: translationRequest(model), timeoutMs: 30000 }, { key: "translate", ok: "translated", err: "translate_failed" })];
    }
    case "translated": {
      const translation = translatedText(msg.body);
      if (msg.status >= 200 && msg.status < 300 && translation.length > 0) return { ...model, loading: false, failed: false, output: translation };
      return { ...model, loading: false, failed: true, output: asciiBytes("Sarvam returned an error. Verify the API key, text, and selected language.") };
    }
    case "translate_failed": return { ...model, loading: false, failed: true, output: asciiBytes("Could not reach Sarvam. Check your connection and try again.") };
    case "open_widget": return [model, Cmd.showWindow("main")];
    case "quit": return [model, Cmd.quitApp()];
  }
}

function targetCode(target: Target): Uint8Array {
  if (target === "hindi") return asciiBytes("hi-IN");
  if (target === "tamil") return asciiBytes("ta-IN");
  if (target === "telugu") return asciiBytes("te-IN");
  return asciiBytes("en-IN");
}

function toneCode(tone: Tone): Uint8Array {
  if (tone === "formal") return asciiBytes("formal");
  if (tone === "modern") return asciiBytes("modern-colloquial");
  if (tone === "classic") return asciiBytes("classic-colloquial");
  return asciiBytes("code-mixed");
}

function translationRequest(model: Model): Uint8Array {
  const before = asciiBytes('{"input":');
  const middle = asciiBytes(',"source_language_code":"auto","target_language_code":');
  const afterTarget = asciiBytes(',"model":"mayura:v1","numerals_format":');
  const afterNumerals = asciiBytes(',"mode":');
  const end = asciiBytes("}");
  const escaped = jsonString(model.inputText);
  const target = jsonString(targetCode(model.target));
  const numerals = jsonString(model.nativeNumerals ? asciiBytes("native") : asciiBytes("international"));
  const tone = jsonString(toneCode(model.tone));
  const out = new Uint8Array(before.length + escaped.length + middle.length + target.length + afterTarget.length + numerals.length + afterNumerals.length + tone.length + end.length);
  let at = 0;
  out.set(before, at); at += before.length;
  out.set(escaped, at); at += escaped.length;
  out.set(middle, at); at += middle.length;
  out.set(target, at); at += target.length;
  out.set(afterTarget, at); at += afterTarget.length;
  out.set(numerals, at); at += numerals.length;
  out.set(afterNumerals, at); at += afterNumerals.length;
  out.set(tone, at); at += tone.length;
  out.set(end, at);
  return out;
}

function jsonString(value: Uint8Array): Uint8Array {
  let length = 2;
  for (const byte of value) length += byte === 34 || byte === 92 || byte === 10 || byte === 13 || byte === 9 ? 2 : 1;
  const out = new Uint8Array(length);
  let at = 0;
  out[at] = 34; at += 1;
  for (const byte of value) {
    if (byte === 34 || byte === 92) { out[at] = 92; out[at + 1] = byte; at += 2; }
    else if (byte === 10) { out[at] = 92; out[at + 1] = 110; at += 2; }
    else if (byte === 13) { out[at] = 92; out[at + 1] = 114; at += 2; }
    else if (byte === 9) { out[at] = 92; out[at + 1] = 116; at += 2; }
    else { out[at] = byte; at += 1; }
  }
  out[at] = 34;
  return out;
}

function translatedText(body: Uint8Array): Uint8Array {
  const key = asciiBytes('"translated_text":"');
  const start = body.indexOf(key);
  if (start < 0) return new Uint8Array(0);
  const from = start + key.length;
  let at = from;
  while (at < body.length) {
    if (body[at] === 34 && (at === from || body[at - 1] !== 92)) return body.slice(from, at);
    at += 1;
  }
  return new Uint8Array(0);
}
