import React, { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import CustomButton from '../components/CustomButton';
import TaskCard from '../components/TaskCard';
import { getData, saveData } from '../utils/storage';

export default function TasksScreen({ navigation }) {
  const [tasks, setTasks] = useState([]);

  async function loadTasks() {
    const savedTasks = (await getData('fitmap_tasks')) || [];
    setTasks(savedTasks);
  }

  useFocusEffect(
    useCallback(() => {
      loadTasks();
    }, [])
  );

  const completedCount = useMemo(
    () => tasks.filter((task) => task.completed).length,
    [tasks]
  );

  const pendingCount = useMemo(
    () => tasks.filter((task) => !task.completed).length,
    [tasks]
  );

  const photosCount = useMemo(
    () => tasks.filter((task) => !!task.photoUri).length,
    [tasks]
  );

  async function toggleTask(taskId) {
    const updatedTasks = tasks.map((task) =>
      task.id === taskId
        ? { ...task, completed: !task.completed }
        : task
    );

    setTasks(updatedTasks);
    await saveData('fitmap_tasks', updatedTasks);
  }

  function openCameraForTask(task) {
    navigation.navigate('Camera', {
      taskId: task.id,
      taskTitle: task.title,
    });
  }

  function confirmDeleteTask(taskId) {
    Alert.alert(
      'Excluir exercício',
      'Tem certeza que deseja excluir este exercício?',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => deleteTask(taskId),
        },
      ]
    );
  }

  async function deleteTask(taskId) {
    const updatedTasks = tasks.filter((task) => task.id !== taskId);

    setTasks(updatedTasks);
    await saveData('fitmap_tasks', updatedTasks);
  }

  const listHeader = (
    <View>
      <View style={styles.headerCard}>
        <View style={styles.logoBox}>
          <Image
            source={require('../../assets/images/logo-fitmap.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.title}>Meus exercícios</Text>

        <Text style={styles.subtitle}>
          Organize seus treinos, acompanhe o progresso e registre fotos dos exercícios concluídos.
        </Text>

        <CustomButton
          title="Novo exercício"
          onPress={() => navigation.navigate('NovaTarefa')}
        />
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{tasks.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statValue}>{completedCount}</Text>
          <Text style={styles.statLabel}>Concluídos</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statValue}>{pendingCount}</Text>
          <Text style={styles.statLabel}>Pendentes</Text>
        </View>
      </View>

      <View style={styles.photoSummaryCard}>
        <Text style={styles.photoSummaryTitle}>Registros com foto</Text>
        <Text style={styles.photoSummaryText}>
          {photosCount} exercício(s) possuem foto registrada.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Lista de exercícios</Text>
    </View>
  );

  return (
    <FlatList
      style={styles.container}
      data={tasks}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <TaskCard
          task={item}
          onToggle={() => toggleTask(item.id)}
          onOpenCamera={() => openCameraForTask(item)}
          onDelete={() => confirmDeleteTask(item.id)}
        />
      )}
      ListHeaderComponent={listHeader}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.listContent}
      ListEmptyComponent={
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Nenhum exercício cadastrado</Text>
          <Text style={styles.emptyText}>
            Toque em “Novo exercício” para começar a organizar seus treinos.
          </Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  listContent: {
    padding: 16,
    paddingBottom: 28,
  },
  headerCard: {
    backgroundColor: '#111827',
    borderRadius: 24,
    padding: 20,
    marginBottom: 14,
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
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#D1D5DB',
    lineHeight: 21,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#2563EB',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4B5563',
  },
  photoSummaryCard: {
    backgroundColor: '#ECFDF5',
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginBottom: 16,
  },
  photoSummaryTitle: {
    color: '#166534',
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 4,
  },
  photoSummaryText: {
    color: '#166534',
    fontSize: 13,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 10,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyTitle: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 6,
  },
  emptyText: {
    textAlign: 'center',
    color: '#6B7280',
    lineHeight: 20,
  },
});