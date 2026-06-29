import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { getData, saveData } from '../utils/storage';

export default function CameraScreen({ navigation, route }) {
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [isReady, setIsReady] = useState(false);
  const [saving, setSaving] = useState(false);

  const taskId = route?.params?.taskId;
  const taskTitle = route?.params?.taskTitle || 'exercício selecionado';

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  async function handleTakePicture() {
    try {
      if (saving) {
        return;
      }

      if (!taskId) {
        Alert.alert(
          'Atenção',
          'Nenhum exercício foi selecionado. Volte para a lista e escolha uma tarefa.'
        );
        return;
      }

      if (!cameraRef.current || !isReady) {
        Alert.alert('Atenção', 'A câmera ainda não está pronta.');
        return;
      }

      setSaving(true);

      const photo = await cameraRef.current.takePictureAsync();

      const tasks = (await getData('fitmap_tasks')) || [];

      if (!tasks.length) {
        Alert.alert('Aviso', 'Crie um exercício antes de registrar a foto.');
        return;
      }

      const taskExists = tasks.some((task) => task.id === taskId);

      if (!taskExists) {
        Alert.alert('Aviso', 'O exercício selecionado não foi encontrado.');
        return;
      }

      const updatedTasks = tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              photoUri: photo.uri,
              completed: true,
            }
          : task
      );

      await saveData('fitmap_tasks', updatedTasks);

      Alert.alert('Sucesso', 'Exercício registrado com foto.', [
        {
          text: 'OK',
          onPress: () => navigation.navigate('Tarefas'),
        },
      ]);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível tirar a foto.');
    } finally {
      setSaving(false);
    }
  }

  if (!permission?.granted) {
    return (
      <View style={styles.permissionContainer}>
        <View style={styles.permissionCard}>
          <Image
            source={require('../../assets/images/logo-fitmap.png')}
            style={styles.permissionLogo}
            resizeMode="contain"
          />

          <Text style={styles.permissionTitle}>Permissão da câmera</Text>

          <Text style={styles.permissionText}>
            Permita o uso da câmera para registrar fotos dos exercícios concluídos.
          </Text>

          <TouchableOpacity
            style={styles.permissionButton}
            onPress={requestPermission}
            activeOpacity={0.85}
          >
            <Text style={styles.permissionButtonText}>Permitir câmera</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.85}
          >
            <Text style={styles.cancelButtonText}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        onCameraReady={() => setIsReady(true)}
      />

      <View style={styles.topOverlay}>
        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>Registrando foto para</Text>
          <Text style={styles.infoTitle}>{taskTitle}</Text>
        </View>
      </View>

      <View style={styles.bottomOverlay}>
        <Text style={styles.helpText}>
          Posicione o exercício ou resultado do treino na câmera e toque no botão abaixo.
        </Text>

        <TouchableOpacity
          style={[styles.captureButton, saving && styles.captureButtonDisabled]}
          onPress={handleTakePicture}
          activeOpacity={0.85}
          disabled={saving}
        >
          <Text style={styles.captureButtonText}>
            {saving ? 'Salvando foto...' : 'Registrar exercício concluído'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.85}
        >
          <Text style={styles.backButtonText}>Voltar sem registrar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  camera: {
    flex: 1,
  },
  topOverlay: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 24 : 16,
    left: 16,
    right: 16,
  },
  infoBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoLabel: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  infoTitle: {
    color: '#111827',
    fontSize: 17,
    fontWeight: '900',
  },
  bottomOverlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: Platform.OS === 'android' ? 28 : 22,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  helpText: {
    color: '#4B5563',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 13,
  },
  captureButton: {
    backgroundColor: '#2563EB',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 10,
  },
  captureButtonDisabled: {
    backgroundColor: '#93C5FD',
  },
  captureButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15,
  },
  backButton: {
    backgroundColor: '#EAF2FF',
    borderRadius: 16,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  backButtonText: {
    color: '#1D4ED8',
    fontWeight: '900',
    fontSize: 14,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F3F4F6',
  },
  permissionCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  permissionLogo: {
    width: 210,
    height: 130,
    marginBottom: 8,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  permissionText: {
    textAlign: 'center',
    color: '#4B5563',
    fontWeight: '700',
    marginBottom: 18,
    lineHeight: 21,
  },
  permissionButton: {
    width: '100%',
    backgroundColor: '#2563EB',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 10,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15,
  },
  cancelButton: {
    width: '100%',
    backgroundColor: '#EAF2FF',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  cancelButtonText: {
    color: '#1D4ED8',
    fontWeight: '900',
  },
});