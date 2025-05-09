import React, { useCallback, useEffect, useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  View,
  Modal,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  PermissionsAndroid,
  Platform,
  ActivityIndicator,
} from "react-native";
import { BleManager, Device } from "react-native-ble-plx";
import MDS from "expo-mds";

const bleManager = new BleManager();

type ConnectedDevice = { serial: string; address: string };

const App = () => {
  const isDarkMode = useColorScheme() === "dark";
  const [devices, setDevices] = useState<Device[]>([]);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string>();
  const [deviceConnected, setDeviceConnected] = useState<ConnectedDevice | null>(null);
  const [value, setValue] = useState<{
    Uri: string;
    Method: string;
    Body?: { rrData: number[]; average: number };
  } | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const backgroundStyle = {
    backgroundColor: "white",
    flex: 1,
  };

  useEffect(() => {
    if (Platform.OS === "android") {
      PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION).then((granted) => {
        if (!granted) {
          PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
        }
      });
    }
  }, []);

  const startScan = useCallback(() => {
    setScanning(true);
    bleManager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.error(error);
        return;
      }

      if (device?.name?.includes("Movesense")) {
        setDevices((prev) => {
          if (prev.find((d) => d.id === device.id)) {
            return prev;
          }
          return [...prev, device];
        });
      }
    });
  }, []);

  const stopScan = useCallback(() => {
    setScanning((prev) => {
      if (prev) {
        bleManager.stopDeviceScan();
      }
      return false;
    });
  }, []);

  useEffect(() => {
    MDS.setHandlers(
      (serial, address) => {
        setDeviceConnected({ serial, address });
      },
      () => {
        setDeviceConnected(null);
      }
    );
  }, []);

  useEffect(() => {
    if (deviceConnected) {
      stopScan();
      const key = MDS.subscribe(
        `${deviceConnected.serial}/Meas/HR`,
        (notification) => {
          setValue(JSON.parse(notification));
          setLoading(false);
        },
        (e) => {
          setError("message" in e ? e.message : e);
          setLoading(false);
        }
      );

      return () => {
        if (key) {
          MDS.unsubscribe(key);
        }
      };
    }
  }, [deviceConnected, stopScan]);

  return (
    <SafeAreaView style={{ ...backgroundStyle, margin: 20 }}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={backgroundStyle.backgroundColor} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" style={backgroundStyle}>
        <View style={styles.header}>
          <Text style={styles.appTitle}>Heart Rate Monitor</Text>
        </View>

        <View style={styles.heartRateContainer}>
          {loading ? (
            <ActivityIndicator size="large" color="#E53935" />
          ) : (
            <>
              <Text style={styles.heartRateText}>{value?.Body ? Math.round(value.Body.average) : "--"} bpm</Text>
            </>
          )}
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        {!deviceConnected ? (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => {
              setModalVisible(true);
              startScan();
            }}
          >
            <Text style={styles.primaryButtonText}>Search Devices</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => {
              MDS.disconnect(deviceConnected.address);
            }}
          >
            <Text style={styles.secondaryButtonText}>Disconnect</Text>
          </TouchableOpacity>
        )}

        <Modal visible={modalVisible} animationType="fade" transparent={true}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Available Devices</Text>
              {devices.length > 0 ? (
                devices.map((d) => (
                  <TouchableOpacity
                    key={d.id}
                    style={styles.deviceCard}
                    activeOpacity={0.8}
                    onPress={() => {
                      setLoading(true);
                      MDS.connect(d.id);
                      setModalVisible(false);
                      stopScan();
                    }}
                  >
                    <Text style={styles.deviceName}>{d.name}</Text>
                    <Text style={styles.deviceId}>{d.id}</Text>
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={styles.noDevicesText}>No devices found. Please wait...</Text>
              )}
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setModalVisible(false);
                  stopScan();
                }}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    marginBottom: 30,
  },
  appTitle: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#333",
  },
  heartRateContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 40,
    padding: 20,
    borderRadius: 150,
    backgroundColor: "#FFEBEE",
    width: 200,
    height: 200,
    alignSelf: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  heartRateText: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#E53935",
    textAlign: "center",
  },
  primaryButton: {
    backgroundColor: "#007BFF",
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
    alignItems: "center",
    marginVertical: 10,
    alignSelf: "center",
  },
  primaryButtonText: {
    fontSize: 16,
    color: "white",
    fontWeight: "bold",
  },
  secondaryButton: {
    backgroundColor: "#E53935",
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
    alignItems: "center",
    marginVertical: 10,
    alignSelf: "center",
  },
  secondaryButtonText: {
    fontSize: 16,
    color: "white",
    fontWeight: "bold",
  },
  errorText: {
    fontSize: 16,
    textAlign: "center",
    marginVertical: 5,
    color: "red",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "90%",
    backgroundColor: "white",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 20,
  },
  deviceCard: {
    width: "100%",
    backgroundColor: "#f9f9f9",
    padding: 15,
    borderRadius: 10,
    marginVertical: 10,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  deviceName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  deviceId: {
    fontSize: 14,
    color: "#666",
    marginTop: 5,
  },
  noDevicesText: {
    fontSize: 16,
    color: "#999",
    marginVertical: 20,
    textAlign: "center",
  },
  closeButton: {
    marginTop: 20,
    backgroundColor: "#007BFF",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  closeButtonText: {
    fontSize: 16,
    color: "white",
    fontWeight: "bold",
  },
});

export default App;
