import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

type User = {
  username: string;
  hasNewMessage: boolean;
};

export default function ChatListScreen() {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const router = useRouter();

  useEffect(() => {
    const loadUsers = async () => {
      const username = await AsyncStorage.getItem("username");
    //   console.log("Loaded username from AsyncStorage:", username);

      const authResponse = await AsyncStorage.getItem("auth_response");
    //   console.log("Loaded authResponse from AsyncStorage:", authResponse);

      const parsed = authResponse ? JSON.parse(authResponse) : null;
    //   console.log("Parsed authResponse:", parsed);

      if (username && parsed?.users) {
        setCurrentUser(username);
        const otherUsers = parsed.users
          .map((u: { username: string }) => ({
            username: u.username,
            hasNewMessage: false, // Initialize with no new messages
          }))
          .filter((u: User) => u.username !== username);

        setUsers(otherUsers);
      }
    };

    loadUsers();

    // Set up WebSocket connection
    const serverIp = "192.168.1.153"; // Replace with your server IP
    ws.current = new WebSocket(`ws://${serverIp}:8080`);

    ws.current.onmessage = async (e) => {
      const data = JSON.parse(e.data);
      if (data.type === "NEW_MESSAGE") {
        // console.log("New message received:", data);

        // Save the new message to AsyncStorage
        const storedMessages = await AsyncStorage.getItem("messages");
        const parsedMessages = storedMessages ? JSON.parse(storedMessages) : [];
        const updatedMessages = [...parsedMessages, data];
        await AsyncStorage.setItem("messages", JSON.stringify(updatedMessages));

        // Update the user list to show the new message indicator
        setUsers((prevUsers) =>
          prevUsers.map((user) =>
            user.username === data.sender
              ? { ...user, hasNewMessage: true }
              : user
          )
        );
      }
    };

    return () => {
      ws.current?.close();
    };
  }, []);

  const openChat = (toUsername: string) => {
    setUsers((prevUsers) =>
      prevUsers.map((user) =>
        user.username === toUsername ? { ...user, hasNewMessage: false } : user
      )
    );

    router.push({
      pathname: "/chat",
      params: { username: currentUser, recipient: toUsername },
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Чаты</Text>
      <FlatList
        data={users}
        keyExtractor={(item) => item.username}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => openChat(item.username)}
            style={styles.userItem}
          >
            <Text style={styles.username}>{item.username.charAt(0).toUpperCase() + item.username.slice(1)}</Text>
            {item.hasNewMessage && (
              <Text style={styles.newMessageIndicator}>Новое сообщение</Text>
            )}
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text>Список пуст</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#fff",
  },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 12 },
  userItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  username: {
    fontSize: 18,
  },
  newMessageIndicator: {
    fontSize: 14,
    color: "red",
    marginTop: 4,
  },
});
