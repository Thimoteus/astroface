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

type Label = import("piu/MC-types").Label;
type Port = import("piu/MC-types").Port;

// Updated when PKJS delivers the phone's longitude; until then ALST is GAST.
let longitude = Deg_make(0);

const pad2 = (n: number): string => (n < 10 ? "0" : "") + n;

const formatALST = (date: Date): string => {
  const [h, m, s] = alst(date, longitude);
  return `${pad2(h)}:${pad2(m)}:${pad2(Math.floor(s))}`;
};

const formatTime = (date: Date): string =>
  `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;

const formatDate = (date: Date): string =>
  `${pad2(date.getFullYear() % 100)}/${pad2(date.getMonth() + 1)}/${pad2(date.getDate())}`;

const backgroundSkin = new Skin({ fill: "black" });
const timeStyleLeft = new Style({
  font: "bold 14px Gothic",
  color: "#FF5555",
  horizontal: "left",
  vertical: "middle"
});
const dateStyleRight = new Style({
  font: "bold 14px Gothic",
  color: "#FF5555",
  horizontal: "right",
  vertical: "middle"
});
const alstStyleLeft = new Style({
  font: "bold 14px Gothic",
  color: "#FF5555",
  horizontal: "left",
  vertical: "middle"
});
const timeStyleCenter = new Style({
  font: "bold 18px Gothic",
  color: "#FF5555",
  horizontal: "center",
  vertical: "middle"
});
const dateStyleCenter = new Style({
  font: "bold 14px Gothic",
  color: "#FF5555",
  horizontal: "center",
  vertical: "middle"
});
const alstStyleCenter = new Style({
  font: "bold 18px Gothic",
  color: "#FF5555",
  horizontal: "center",
  vertical: "middle"
});
const compassStyle = new Style({
  font: "bold 14px Gothic",
  color: "#FF5555",
  horizontal: "center",
  vertical: "middle"
});
const starLabelStyle = new Style({
  font: "9px Gothic",
  color: "#FFFFFF",
  horizontal: "left",
  vertical: "middle"
});

const STAR_COLORS = [
  "#AAAAFF",
  "#AAFFFF",
  "#FFFFFF",
  "#FFFFAA",
  "#FFAA55",
  "#FF5555"
];

interface StarLabel {
  x: number;
  y: number;
  text: string;
}

class StarFieldBehavior extends Behavior {
  stars: Uint8Array | null = null;
  labels: StarLabel[] | null = null;

  setStars(port: Port, buffer: ArrayBuffer): void {
    const bytes = new Uint8Array(buffer);
    // Must match PROTOCOL_VERSION in src/pkjs/astronomy.ts.
    if (bytes.length < 3 || bytes[0] !== 4) return;
    this.stars = bytes;
    const count = bytes[1] | (bytes[2] << 8);
    let p = 3 + count * 4;
    const labels: StarLabel[] = [];
    if (p < bytes.length) {
      const namedCount = bytes[p++];
      for (let i = 0; i < namedCount && p + 2 < bytes.length; i++) {
        const lx = bytes[p++];
        const ly = bytes[p++];
        const nameLen = bytes[p++];
        if (p + nameLen > bytes.length) break;
        let text = "";
        for (let j = 0; j < nameLen; j++) text += String.fromCharCode(bytes[p + j]);
        p += nameLen;
        labels.push({ x: lx, y: ly, text });
      }
    }
    this.labels = labels;
    port.invalidate();
  }

  onDraw(port: Port, x: number, y: number, width: number, height: number): void {
    port.fillColor("black", x, y, width, height);
    const s = this.stars;
    if (!s) return;
    const count = s[1] | (s[2] << 8);
    const end = Math.min(s.length, 3 + count * 4);
    for (let i = 3; i + 3 < end; i += 4) {
      const sx = s[i];
      const sy = s[i + 1];
      const mt = s[i + 2];
      const ci = s[i + 3];
      const color = ci < STAR_COLORS.length ? STAR_COLORS[ci] : "white";
      if (mt <= 15) {
        port.fillColor(color, sx, sy - 1, 1, 3);
        port.fillColor(color, sx - 1, sy, 3, 1);
      } else {
        const size = mt <= 25 ? 2 : 1;
        const off = size >> 1;
        port.fillColor(color, sx - off, sy - off, size, size);
      }
    }
    const labels = this.labels;
    if (labels) {
      for (let i = 0; i < labels.length; i++) {
        const lb = labels[i];
        port.drawString(lb.text, starLabelStyle, "#FFFFFF", lb.x + 3, lb.y - 5, 40, 12);
      }
    }
  }
}

// Round displays (gabbro) clip the corners, so stack the labels along the
// vertical axis near the N/S cardinals instead of placing them in corners.
const isRound = screen.width === screen.height;

class FaceApplicationBehavior {
  onDisplaying(application: Application): void {
    const port = application.first as Port;
    const timeLabel = port.next as Label;
    const dateLabel = timeLabel.next as Label;
    const alstLabel = dateLabel.next as Label;

    const render = (date: Date): void => {
      timeLabel.string = formatTime(date);
      dateLabel.string = formatDate(date);
      alstLabel.string = formatALST(date);
    };
    render(new Date());
    watch.addEventListener("secondchange", (e) => {
      render(e.date);
    });

    new Message({
      keys: ["LONGITUDE", "STARS"],
      input: 2048,
      onReadable(): void {
        const msg = this.read();
        const lon = msg.get("LONGITUDE");
        if (typeof lon === "string") {
          const parsed = Number(lon);
          if (Number.isFinite(parsed)) longitude = Deg_make(parsed);
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
    ...(isRound
      ? [
          Label($, { top: 18, left: 0, right: 0, height: 22, style: timeStyleCenter }),
          Label($, { top: 40, left: 0, right: 0, height: 16, style: dateStyleCenter }),
          Label($, { bottom: 18, left: 0, right: 0, height: 22, style: alstStyleCenter })
        ]
      : [
          Label($, { top: 2, left: 4, width: 80, height: 14, style: timeStyleLeft }),
          Label($, { top: 2, right: 4, width: 80, height: 14, style: dateStyleRight }),
          Label($, { bottom: 2, left: 4, width: 80, height: 14, style: alstStyleLeft })
        ]),
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
