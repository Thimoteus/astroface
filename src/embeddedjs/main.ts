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

class FaceApplicationBehavior {
  onDisplaying(application: Application): void {
    const column = application.first as Column;
    const timeLabel = column.first as Label;
    const longitudeLabel = timeLabel.next as Label;

    timeLabel.string = formatALST(new Date());
    watch.addEventListener("secondchange", (e) => {
      timeLabel.string = formatALST(e.date);
    });

    new Message({
      keys: ["LONGITUDE"],
      onReadable(): void {
        const msg = this.read();
        const value = msg.get("LONGITUDE");
        if (typeof value === "string") {
          longitudeLabel.string = value;
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
    Column($, {
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      contents: [
        Label($, { left: 0, right: 0, height: 90, style: clockStyle }),
        Label($, { left: 0, right: 0, height: 28, style: dateStyle })
      ]
    })
  ]
}));

export default new FaceApplication(null, {
  displayListLength: 2048,
  touchCount: 0,
  pixels: screen.width * 4
});
