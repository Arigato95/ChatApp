import React, { useState, useRef } from "react";
import { View, Text, TextInput, Button, StyleSheet, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

const WS_URL = "ws://192.168.1.153:8080"; // your actual IP

export default function UsernameScreen() {
  const [username, setUsername] = useState("");
  const ws = useRef<WebSocket | null>(null);
  const router = useRouter();

  const handleLogin = async () => {
    if (!username.trim()) return;

    ws.current = new WebSocket(WS_URL);
    // console.log("WebSocket created:", ws.current);

    ws.current.onopen = () => {
          // console.log("WebSocket connection opened. Sending AUTH message...");

      ws.current?.send(JSON.stringify({ type: "AUTH", username }));

          // console.log("AUTH message sent:", { type: "AUTH", username });

    };

    ws.current.onmessage = async (e) => {
          // console.log("Received WebSocket message:", e.data);

      const data = JSON.parse(e.data);
          // console.log("Parsed data from server:", data);


      if (data.type === "AUTH_SUCCESS") {
              // console.log("AUTH_SUCCESS received with data:", data);

        await AsyncStorage.setItem("username", data.username);
        await AsyncStorage.setItem("messages", JSON.stringify(data.messages || []));
        await AsyncStorage.setItem("auth_response", JSON.stringify(data));

        ws.current?.close();
        router.push("/chatlist"); 
              // console.log("Navigated to tabs screen");

      }
    };

    ws.current.onerror = (err) => {
      Alert.alert(
        `WebSocket error", "Check if the server is running and accessible. ${err}`
      );
    };
  };

  const enterChat = () => {
    if (username.trim()) {
      router.push({ pathname: '/chat', params: { username } });
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        placeholder="Введите имя пользователя"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        style={styles.input}
      />
      <Button title="Войти" onPress={handleLogin} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 20 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 12,
    borderRadius: 6,
    marginBottom: 20,
  },
});
