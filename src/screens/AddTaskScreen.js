import React, { useState } from 'react';
import {
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import CustomButton from '../components/CustomButton';
import CustomInput from '../components/CustomInput';
import { getData, saveData } from '../utils/storage';

export default function AddTaskScreen({ navigation }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  async function handleSaveTask() {
    Keyboard.dismiss();

    const formattedTitle = title.trim();
    const formattedDescription = description.trim();

    if (!formattedTitle) {
      Alert.alert('Atenção', 'Digite o nome do exercício.');
      return;
    }

    if (formattedTitle.length < 3) {
      Alert.alert('Atenção', 'O nome do exercício precisa ter pelo menos 3 caracteres.');
      return;
    }

    try {
      const tasks = (await getData('fitmap_tasks')) || [];

      const alreadyExists = tasks.some(
        (task) => task.title.toLowerCase() === formattedTitle.toLowerCase()
      );

      if (alreadyExists) {
        Alert.alert('Atenção', 'Já existe um exercício cadastrado com esse nome.');
        return;
      }

      const newTask = {
        id: Date.now().toString(),
        title: formattedTitle,
        description: formattedDescription || 'Sem descrição informada.',
        completed: false,
        photoUri: null,
        createdAt: new Date().toISOString(),
      };

      const updatedTasks = [...tasks, newTask];

      await saveData('fitmap_tasks', updatedTasks);

      Alert.alert('Sucesso', 'Exercício cadastrado com sucesso.', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível salvar o exercício.');
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerCard}>
          <View style={styles.logoBox}>
            <Image
              source={require('../../assets/images/logo-fitmap.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <Text style={styles.title}>Novo exercício</Text>

          <Text style={styles.subtitle}>
            Cadastre um exercício para acompanhar seu progresso e registrar uma foto após a conclusão.
          </Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Dados do exercício</Text>

          <Text style={styles.label}>Nome do exercício</Text>
          <CustomInput
            placeholder="Ex.: Treino de pernas"
            value={title}
            onChangeText={setTitle}
            returnKeyType="next"
          />

          <Text style={styles.label}>Descrição</Text>
          <CustomInput
            placeholder="Ex.: Agachamento, leg press e panturrilha"
            value={description}
            onChangeText={setDescription}
            multiline
          />

          <View style={styles.tipBox}>
            <Text style={styles.tipTitle}>Dica</Text>
            <Text style={styles.tipText}>
              Depois de cadastrar, você poderá marcar o exercício como concluído e registrar uma foto.
            </Text>
          </View>

          <CustomButton title="Salvar exercício" onPress={handleSaveTask} />

          <CustomButton
            title="Cancelar"
            onPress={() => navigation.goBack()}
            variant="secondary"
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  content: {
    padding: 16,
    paddingBottom: 28,
  },
  headerCard: {
    backgroundColor: '#111827',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
  },
  logoBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  logo: {
    width: 190,
    height: 105,
  },
  title: {
    fontSize: 27,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#D1D5DB',
    lineHeight: 21,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#111827',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.06,
    shadowRadius: 7,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 14,
  },
  label: {
    fontSize: 14,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 6,
  },
  tipBox: {
    backgroundColor: '#ECFDF5',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginBottom: 16,
  },
  tipTitle: {
    color: '#166534',
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 4,
  },
  tipText: {
    color: '#166534',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
});