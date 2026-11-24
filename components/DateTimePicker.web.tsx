import { createElement } from "react";

// Web stand-in for @react-native-community/datetimepicker (which has no web
// support). Renders the browser's own date/time input and calls onChange with
// the same (event, date) shape the native picker uses.
type Props = {
  value: Date;
  mode?: "date" | "time";
  onChange?: (event: unknown, date?: Date) => void;
  [key: string]: unknown;
};

const pad = (n: number) => String(n).padStart(2, "0");

export default function DateTimePicker({ value, mode = "date", onChange }: Props) {
  const inputValue =
    mode === "time"
      ? `${pad(value.getHours())}:${pad(value.getMinutes())}`
      : `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;

  const handleChange = (e: { target: { value: string } }) => {
    const v = e.target.value;
    if (!v) return;
    const next = new Date(value);
    if (mode === "time") {
      const [h, m] = v.split(":").map(Number);
      next.setHours(h, m, 0, 0);
    } else {
      // Build from parts so the date stays in local time (not UTC)
      const [y, mo, d] = v.split("-").map(Number);
      // While a year is being typed the browser reports 0002, 0020, 0202… — wait for a full year
      if (y < 1900) return;
      next.setFullYear(y, mo - 1, d);
    }
    onChange?.({ type: "set" }, next);
  };

  // Uncontrolled (defaultValue): if React re-applied `value` on every keystroke it would wipe
  // half-typed years. The picker remounts each time it opens, so it always starts from the current date.
  return createElement("input", {
    type: mode,
    defaultValue: inputValue,
    onChange: handleChange,
    style: {
      fontSize: 18,
      padding: 12,
      borderRadius: 10,
      border: "1.5px solid #ddd",
      width: "100%",
      boxSizing: "border-box",
      marginBottom: 12,
    },
  });
}
