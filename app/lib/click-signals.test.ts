import { afterEach, describe, expect, it, vi } from "vitest";
import { clickSignals, deviceClass, readClickSignals } from "./click-signals";

// 6/10/26: one visitor tapped "call" 14 times in 34 seconds and nothing stored
// could say whether it was a person or a tool. These tests lock the two signals
// that now answer that, and the coarse device split. The User-Agent strings are
// the generic public formats of each browser family, not anyone's real device.

const UA = {
  iphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  androidPhone:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
  samsungPhone:
    "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36",
  firefoxAndroidPhone: "Mozilla/5.0 (Android 14; Mobile; rv:127.0) Gecko/127.0 Firefox/127.0",
  // an Android phone whose User-Agent does not carry the word "Mobile"
  operaMiniAndroidPhone: "Opera/9.80 (Android; Opera Mini/36.2.2254/191.280; U; en) Presto/2.12.423 Version/12.16",
  operaMiniIphone: "Opera/9.80 (iPhone; Opera Mini/16.0.14/191.280; U; en) Presto/2.12.423 Version/12.16",
  kindleFire:
    "Mozilla/5.0 (Linux; Android 9; KFMAWI) AppleWebKit/537.36 (KHTML, like Gecko) Silk/96.2.6 like Chrome/96.0.4664.92 Safari/537.36",
  ipadOld:
    "Mozilla/5.0 (iPad; CPU OS 12_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1 Mobile/15E148 Safari/604.1",
  androidTablet:
    "Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  firefoxAndroidTablet: "Mozilla/5.0 (Android 13; Tablet; rv:127.0) Gecko/127.0 Firefox/127.0",
  windowsChrome:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  macSafari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  linuxFirefox: "Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0",
};

describe("deviceClass", () => {
  it("calls a phone a mobile", () => {
    expect(deviceClass(UA.iphone)).toBe("mobile");
    expect(deviceClass(UA.androidPhone)).toBe("mobile");
    expect(deviceClass(UA.samsungPhone)).toBe("mobile");
    expect(deviceClass(UA.firefoxAndroidPhone)).toBe("mobile");
  });

  // The first version tested "Android without the word Mobile" before the phone
  // signs, so this phone was stored as a tablet.
  it("calls Opera Mini on a phone a mobile, although its User-Agent lacks 'Mobile'", () => {
    expect(deviceClass(UA.operaMiniAndroidPhone)).toBe("mobile");
    expect(deviceClass(UA.operaMiniIphone)).toBe("mobile");
  });

  it("calls an iPad or an Android without 'Mobile' a tablet", () => {
    expect(deviceClass(UA.ipadOld)).toBe("tablet");
    expect(deviceClass(UA.androidTablet)).toBe("tablet");
    expect(deviceClass(UA.firefoxAndroidTablet)).toBe("tablet");
    expect(deviceClass(UA.kindleFire)).toBe("tablet");
  });

  it("calls a computer a desktop", () => {
    expect(deviceClass(UA.windowsChrome)).toBe("desktop");
    expect(deviceClass(UA.macSafari)).toBe("desktop");
    expect(deviceClass(UA.linuxFirefox)).toBe("desktop");
  });

  it("does not guess when there is no User-Agent", () => {
    expect(deviceClass(null)).toBeNull();
    expect(deviceClass(undefined)).toBeNull();
    expect(deviceClass("")).toBeNull();
    expect(deviceClass("   ")).toBeNull();
  });
});

describe("readClickSignals", () => {
  it("takes the device from the User-Agent and the flag from the body", () => {
    expect(readClickSignals({ automation: false }, UA.windowsChrome)).toEqual({ device: "desktop", automated: false });
    expect(readClickSignals({ automation: true }, UA.windowsChrome)).toEqual({ device: "desktop", automated: true });
    expect(readClickSignals({ automation: false }, UA.iphone)).toEqual({ device: "mobile", automated: false });
  });

  it("leaves the flag empty when the client did not report it", () => {
    // a page cached in the visitor's browser from before the field existed
    expect(readClickSignals({}, UA.iphone)).toEqual({ device: "mobile", automated: null });
    expect(readClickSignals(null, UA.iphone)).toEqual({ device: "mobile", automated: null });
    expect(readClickSignals(undefined, UA.iphone)).toEqual({ device: "mobile", automated: null });
  });

  it("accepts only a real boolean as the client's report", () => {
    for (const odd of ["true", "false", 1, 0, "yes", [], {}]) {
      expect(readClickSignals({ automation: odd }, UA.iphone).automated).toBeNull();
    }
  });
});

describe("clickSignals (in the browser)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reports an automation-controlled browser", () => {
    vi.stubGlobal("navigator", { webdriver: true });
    expect(clickSignals()).toEqual({ automation: true });
  });

  it("reports false for an ordinary browser, however it says so", () => {
    vi.stubGlobal("navigator", { webdriver: false });
    expect(clickSignals()).toEqual({ automation: false });
    vi.stubGlobal("navigator", {});
    expect(clickSignals()).toEqual({ automation: false });
  });

  it("never breaks the click when the browser object is missing or throws", () => {
    vi.stubGlobal("navigator", undefined);
    expect(clickSignals()).toEqual({ automation: false });
    vi.stubGlobal("navigator", {
      get webdriver(): boolean {
        throw new Error("blocked");
      },
    });
    expect(clickSignals()).toEqual({ automation: false });
  });
});
