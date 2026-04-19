import "piu/MC";
import Message from "pebble/message";
// mcrun's build-time tsconfig has no path alias for third-party node_modules,
// even though the runtime bundle picks them up via manifest.json. The project
// tsconfig still resolves these imports for the editor; the suppression
// directives below cover the build-time tsconfig where they would otherwise
// fail to resolve.
// biome-ignore lint/suspicious/noTsIgnore: build-time tsconfig lacks the path alias
// @ts-ignore
import { alst } from "@thimoteus/alst_core/ALST.gen";
// biome-ignore lint/suspicious/noTsIgnore: build-time tsconfig lacks the path alias
// @ts-ignore
import { Deg_make } from "@thimoteus/alst_core/Angles.gen";

type Column = import("piu/MC-types").Column;
type Label = import("piu/MC-types").Label;
type Port = import("piu/MC-types").Port;

const LONGITUDE_DEG = 0;
const LONGITUDE = Deg_make(LONGITUDE_DEG);

const pad2 = (n: number): string => (n < 10 ? "0" : "") + n;

const formatALST = (date: Date): string => {
  const [h, m, s] = alst(date, LONGITUDE);
  return `${pad2(h)}:${pad2(m)}:${pad2(Math.floor(s))}`;
};

const backgroundSkin = new Skin({ fill: "black" });
const clockStyle = new Style({
  font: "bold 28px Gothic",
  color: "white",
  horizontal: "center",
  vertical: "middle"
});
const dateStyle = new Style({
  font: "bold 18px Gothic",
  color: "white",
  horizontal: "center",
  vertical: "middle"
});
const compassStyle = new Style({
  font: "bold 14px Gothic",
  color: "white",
  horizontal: "center",
  vertical: "middle"
});

class StarFieldBehavior extends Behavior {
  stars: Uint8Array | null = null;

  setStars(port: Port, buffer: ArrayBuffer): void {
    const bytes = new Uint8Array(buffer);
    if (bytes.length < 3 || bytes[0] !== 1) return;
    this.stars = bytes;
    port.invalidate();
  }

  onDraw(port: Port, x: number, y: number, width: number, height: number): void {
    port.fillColor("black", x, y, width, height);
    const s = this.stars;
    if (!s) return;
    const count = s[1] | (s[2] << 8);
    const end = Math.min(s.length, 3 + count * 3);
    for (let i = 3; i + 2 < end; i += 3) {
      const sx = s[i];
      const sy = s[i + 1];
      const mt = s[i + 2];
      const size = mt <= 15 ? 3 : mt <= 25 ? 2 : 1;
      const off = size >> 1;
      port.fillColor("white", sx - off, sy - off, size, size);
    }
  }
}

class FaceApplicationBehavior {
  onDisplaying(application: Application): void {
    const port = application.first as Port;
    const column = port.next as Column;
    const timeLabel = column.first as Label;
    const longitudeLabel = timeLabel.next as Label;

    timeLabel.string = formatALST(new Date());
    watch.addEventListener("secondchange", (e) => {
      timeLabel.string = formatALST(e.date);
    });

    new Message({
      keys: ["LONGITUDE", "STARS"],
      input: 2048,
      onReadable(): void {
        const msg = this.read();
        const lon = msg.get("LONGITUDE");
        if (typeof lon === "string") {
          longitudeLabel.string = lon;
        }
        const stars = msg.get("STARS");
        if (stars instanceof ArrayBuffer) {
          port.delegate("setStars", stars);
        }
      }
    });
  }
}

const FaceApplication = Application.template(($) => ({
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
  skin: backgroundSkin,
  Behavior: FaceApplicationBehavior,
  contents: [
    Port($, {
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      Behavior: StarFieldBehavior
    }),
    Column($, {
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      contents: [
        Label($, { left: 0, right: 0, height: 90, style: clockStyle }),
        Label($, { left: 0, right: 0, height: 28, style: dateStyle })
      ]
    }),
    Label($, { top: 2, left: 0, right: 0, height: 14, style: compassStyle, string: "N" }),
    Label($, { bottom: 2, left: 0, right: 0, height: 14, style: compassStyle, string: "S" }),
    Label($, { left: 2, top: 0, bottom: 0, width: 14, style: compassStyle, string: "E" }),
    Label($, { right: 2, top: 0, bottom: 0, width: 14, style: compassStyle, string: "W" })
  ]
}));

export default new FaceApplication(null, {
  displayListLength: 2048,
  touchCount: 0,
  pixels: screen.width * 4
});
