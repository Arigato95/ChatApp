import React, { useEffect, useRef, useState } from "react";
import {
  View,
  TextInput,
  Button,
  FlatList,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  TouchableOpacity,
  Image,
  Modal,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import AsyncStorage from "@react-native-async-storage/async-storage";

type Message = {
  type: string;
  id: string;
  text: string;
  sender: string;
  recipient: string;
  image?: string;
};

export default function ChatScreen() {
  const { username, recipient } = useLocalSearchParams<{
    username: string;
    recipient: string;
  }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [image, setImage] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const ws = useRef<WebSocket | null>(null);
  const flatlistRef = useRef<FlatList>(null);
  const router = useRouter();

  // state for Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [modalImage, setModalImage] = useState<string | null>(null);

  useEffect(() => {
    const loadMessages = async () => {
      const storedMessages = await AsyncStorage.getItem("messages");
      if (storedMessages) {
        const parsedMessages = JSON.parse(storedMessages);
        const relevantMessages = parsedMessages.filter(
          (msg: Message) =>
            (msg.sender === username && msg.recipient === recipient) ||
            (msg.sender === recipient && msg.recipient === username)
        );
        setMessages(relevantMessages);
      }
    };

    loadMessages();
  }, [username, recipient]);

  useEffect(() => {
    const serverIp = "192.168.1.153"; // your local IP
    ws.current = new WebSocket(`ws://${serverIp}:8080`);

    ws.current.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);

        if (data.type === "NEW_MESSAGE") {
          const msg: Message = data;

          if (
            (msg.sender === username && msg.recipient === recipient) ||
            (msg.sender === recipient && msg.recipient === username)
          ) {
            setMessages((prev) => {
              const updatedMessages = prev.some((m) => m.id === msg.id)
                ? prev
                : [...prev, msg];

              // Update AsyncStorage
              AsyncStorage.setItem("messages", JSON.stringify(updatedMessages));

              return updatedMessages;
            });
          }
        }
      } catch (err) {
        console.error("❌ Parse error:", err);
      }
    };

    return () => {
      ws.current?.close();
    };
  }, []);

  useEffect(() => {
    flatlistRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const sendMessage = () => {
    if (input.trim() || image) {
      const msg: Message = {
        type: "SEND_MESSAGE",
        id: Date.now().toString(),
        text: input,
        sender: username || "Unknown",
        recipient: recipient || "",
        image: image || undefined,
      };
      ws.current?.send(JSON.stringify(msg));
      setMessages((prev) =>
        prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
      );
      setInput("");
      setImage(null); // clear selected image after sending
    }
  };

  // Image picking button implementation
  const pickImage = async () => {
    // No permissions request is necessary for launching the image library
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
      base64: false, // to read it manually
    });

    // console.log(result);

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      setImage(`data:image/jpeg;base64,${base64}`);
    }
  };

  // Function to open modal with full-screen image
  const openModal = (imgUri: string) => {
    setModalImage(imgUri);
    setModalVisible(true);
  };

  // Function to close modal
  const closeModal = () => {
    setModalVisible(false);
    setModalImage(null);
  };

  return (
    <>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={10}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.container}>
            <View style={styles.header}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.back()}
              >
                <Text style={styles.backButtonText}>Назад</Text>
              </TouchableOpacity>
              <Text style={styles.headerText}>
                {recipient.charAt(0).toUpperCase() + recipient.slice(1)}
              </Text>
            </View>
            <FlatList
              ref={flatlistRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const isMe = item.sender === username;
                return (
                  <View
                    style={[
                      styles.messageBubble,
                      isMe ? styles.bubbleRight : styles.bubbleLeft,
                    ]}
                  >
                    {/* <Text style={styles.senderName}>{item.sender}</Text> */}
                    {item.text ? <Text>{item.text}</Text> : null}
                    {item.image && (
                      <TouchableOpacity onPress={() => openModal(item.image!)}>
                        <Image
                          source={{ uri: item.image }}
                          style={styles.messageImage}
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              }}
              style={styles.messageList}
            />

            {/* Image Preview */}
            {image && (
              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: image }} style={styles.image} />
              </View>
            )}

            <View style={styles.inputContainer}>
              <TouchableOpacity onPress={pickImage} style={styles.plusButton}>
                <Text style={styles.plusButtonText}>+</Text>
              </TouchableOpacity>
              <TextInput
                value={input}
                onChangeText={setInput}
                style={styles.input}
                placeholder="Введите сообщение"
                onSubmitEditing={sendMessage}
                returnKeyType="send"
              />
              <Button title="Отпр." onPress={sendMessage} />
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      {/* Fullscreen Modal for Image */}
      <Modal visible={modalVisible} transparent={true}>
        <View style={styles.modalContainer}>
          <TouchableOpacity onPress={closeModal} style={styles.modalCloseArea}>
            <Text style={styles.modalCloseText}>Закрыть</Text>
          </TouchableOpacity>
          {modalImage && (
            <Image
              source={{ uri: modalImage }}
              style={styles.fullScreenImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  messageList: { flex: 1, marginBottom: 10 },
  message: {
    padding: 8,
    backgroundColor: "#eee",
    borderRadius: 6,
    marginBottom: 6,
  },
  messageImage: {
    width: 150,
    height: 150,
    marginTop: 8,
    borderRadius: 8,
    resizeMode: "cover",
  },
  sender: { fontWeight: "bold" },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    padding: 10,
  },
  messageBubble: {
    maxWidth: "75%",
    padding: 10,
    marginVertical: 4,
    borderRadius: 10,
  },
  bubbleRight: {
    alignSelf: "flex-end",
    backgroundColor: "#DCF8C6", // light green (sender)
    borderTopRightRadius: 0,
  },
  bubbleLeft: {
    alignSelf: "flex-start",
    backgroundColor: "#E5E5EA", // light gray (receiver)
    borderTopLeftRadius: 0,
  },
  senderName: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 2,
    color: "#555",
  },
  imagePreviewContainer: {
    alignItems: "center",
    marginBottom: 10,
    alignSelf: "flex-start",
  },
  image: {
    width: 50,
    height: 50,
    borderRadius: 8,
    resizeMode: "cover",
  },
  plusButton: {
    backgroundColor: "#007AFF", // Blue color
    width: 30, 
    height: 30, 
    borderRadius: 15, 
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8, 
  },
  plusButtonText: {
    color: "#fff", 
    fontSize: 18, 
    fontWeight: "bold",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  fullScreenImage: {
    width: "100%",
    height: "80%",
  },
  modalCloseArea: {
    position: "absolute",
    top: 40,
    right: 20,
    zIndex: 1,
  },
  modalCloseText: {
    color: "#fff",
    fontSize: 18,
  },
  header: {
    paddingVertical: 10,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
    marginBottom: 10,
  },
  headerText: {
    fontSize: 20,
    fontWeight: "bold",
  },
  backButton: {
    position: "absolute",
    left: 10,
    top: 10,
    padding: 8,
  },
  backButtonText: {
    color: "blue",
    fontSize: 16,
  },
});
