import { Platform, Pressable, Text, TextInput } from "react-native";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { colors, ui } from "./ui";
export default function ScheduleInput({
  mode,
  date,
  time,
  onChange,
}: {
  mode: "date" | "time";
  date: string;
  time: string;
  onChange: (value: string) => void;
}) {
  const text = mode === "date" ? date : time;
  function open() {
    const today = new Date().toLocaleDateString("en-CA", {
      timeZone: "Asia/Kolkata",
    });
    const selected = new Date(
      (date || today) + "T" + (time || "10:00") + "+05:30",
    );
    DateTimePickerAndroid.open({
      value: Number.isNaN(selected.getTime()) ? new Date() : selected,
      mode,
      timeZoneName: "Asia/Kolkata",
      is24Hour: true,
      minimumDate: mode === "date" ? new Date() : undefined,
      onChange: (event, value) => {
        if (event.type === "set" && value)
          onChange(
            mode === "date"
              ? value.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
              : value.toLocaleTimeString("en-GB", {
                  timeZone: "Asia/Kolkata",
                  hour: "2-digit",
                  minute: "2-digit",
                }),
          );
      },
    });
  }
  if (Platform.OS !== "android")
    return (
      <TextInput
        style={ui.input}
        accessibilityLabel={"Shoot " + mode}
        placeholder={mode === "date" ? "YYYY-MM-DD" : "HH:MM"}
        value={text}
        onChangeText={onChange}
      />
    );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={"Choose shoot " + mode}
      onPress={open}
      style={ui.input}
    >
      <Text style={{ color: text ? colors.ink : colors.muted, fontSize: 15 }}>
        {text || (mode === "date" ? "Choose date" : "Choose time")}
      </Text>
    </Pressable>
  );
}
