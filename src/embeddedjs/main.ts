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

// Null sentinel distinguishes "never received a fix" from "user is literally at 0° longitude",
// which matters because a true 0° user should still see ALST. Persisted to localStorage so
// that last-known longitude survives relaunches until the phone delivers a fresh fix.
// biome-ignore lint/suspicious/noExplicitAny: Deg_make's return type isn't visible to the build-time tsconfig
let longitude: any = null;
const storedLon = localStorage.getItem("longitude");
if (storedLon !== null) {
  const parsedStored = Number(storedLon);
  if (Number.isFinite(parsedStored)) longitude = Deg_make(parsedStored);
}

const pad2 = (n: number): string => (n < 10 ? "0" : "") + n;

// biome-ignore lint/suspicious/noExplicitAny: see `longitude` declaration above
const formatALST = (date: Date, lon: any): string => {
  const [h, m] = alst(date, lon);
  return `${pad2(h)}:${pad2(m)}`;
};

const formatTime = (date: Date): string =>
  `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

const formatDate = (date: Date): string =>
  `${pad2(date.getFullYear() % 100)}/${pad2(date.getMonth() + 1)}/${pad2(date.getDate())}`;

// Round displays (gabbro) clip the corners, so stack the labels along the
// vertical axis near the N/S cardinals instead of placing them in corners.
const isRound = screen.width === screen.height;

const backgroundSkin = new Skin({ fill: "black" });
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
const timeStyle = new Style({
  font: isRound ? "bold 18px Gothic" : "bold 14px Gothic",
  color: "#FF5555",
  horizontal: isRound ? "center" : "left",
  vertical: "middle"
});
const dateStyle = new Style({
  font: "bold 14px Gothic",
  color: "#FF5555",
  horizontal: isRound ? "center" : "right",
  vertical: "middle"
});
const alstStyle = new Style({
  font: isRound ? "bold 18px Gothic" : "bold 14px Gothic",
  color: "#FF5555",
  horizontal: isRound ? "center" : "left",
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
    if (bytes.length < 3 || bytes[0] !== 5) return;
    this.stars = bytes;
    const count = bytes[1] | (bytes[2] << 8);
    let p = 3 + count * 3;
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
    const end = Math.min(s.length, 3 + count * 3);
    for (let i = 3; i + 2 < end; i += 3) {
      const sx = s[i];
      const sy = s[i + 1];
      const packed = s[i + 2];
      const sizeCode = (packed >> 5) & 0x03;
      const ci = packed & 0x07;
      const color = ci < STAR_COLORS.length ? STAR_COLORS[ci] : "white";
      if (sizeCode === 0) {
        port.fillColor(color, sx, sy - 1, 1, 3);
        port.fillColor(color, sx - 1, sy, 3, 1);
      } else {
        const size = sizeCode === 1 ? 2 : 1;
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

class FaceApplicationBehavior {
  onDisplaying(application: Application): void {
    const port = application.first as Port;
    const timeLabel = port.next as Label;
    const dateLabel = timeLabel.next as Label;
    const alstLabel = dateLabel.next as Label;

    const render = (date: Date): void => {
      timeLabel.string = formatTime(date);
      dateLabel.string = formatDate(date);
      if (longitude === null) {
        alstLabel.visible = false;
      } else {
        alstLabel.string = formatALST(date, longitude);
        alstLabel.visible = true;
      }
    };
    render(new Date());
    watch.addEventListener("minutechange", (e) => {
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
          if (Number.isFinite(parsed)) {
            longitude = Deg_make(parsed);
            localStorage.setItem("longitude", parsed.toString());
            render(new Date());
          }
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
          Label($, { top: 18, left: 0, right: 0, height: 22, style: timeStyle }),
          Label($, { top: 40, left: 0, right: 0, height: 16, style: dateStyle }),
          Label($, { bottom: 18, left: 0, right: 0, height: 22, style: alstStyle })
        ]
      : [
          Label($, { top: 2, left: 4, width: 80, height: 14, style: timeStyle }),
          Label($, { top: 2, right: 4, width: 80, height: 14, style: dateStyle }),
          Label($, { bottom: 2, left: 4, width: 80, height: 14, style: alstStyle })
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
