import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function TaskCard({ task, onToggle, onOpenCamera, onDelete }) {
  const isCompleted = !!task?.completed;
  const hasPhoto = !!task?.photoUri;

  const title = task?.title || 'Exercício sem título';
  const description = task?.description || 'Sem descrição informada.';

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
        </View>

        <View
          style={[
            styles.statusBadge,
            isCompleted ? styles.completedBadge : styles.pendingBadge,
          ]}
        >
          <Text
            style={[
              styles.statusText,
              isCompleted ? styles.completedText : styles.pendingText,
            ]}
          >
            {isCompleted ? 'Concluído' : 'Pendente'}
          </Text>
        </View>
      </View>

      {hasPhoto ? (
        <View style={styles.photoWrapper}>
          <Image
            source={{ uri: task.photoUri }}
            style={styles.image}
            resizeMode="cover"
          />

          <View style={styles.photoBadge}>
            <Text style={styles.photoBadgeText}>Foto registrada</Text>
          </View>
        </View>
      ) : (
        <View style={styles.emptyPhoto}>
          <Text style={styles.emptyPhotoIcon}>📷</Text>
          <Text style={styles.emptyPhotoText}>Nenhuma foto registrada</Text>
          <Text style={styles.emptyPhotoSubtext}>
            Registre uma foto após concluir o exercício.
          </Text>
        </View>
      )}

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[
            styles.actionButton,
            isCompleted ? styles.secondaryButton : styles.primaryButton,
          ]}
          onPress={onToggle}
          activeOpacity={0.85}
        >
          <Text
            style={[
              styles.actionButtonText,
              isCompleted && styles.secondaryButtonText,
            ]}
          >
            {isCompleted ? 'Marcar pendente' : 'Concluir'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cameraButton}
          onPress={onOpenCamera}
          activeOpacity={0.85}
        >
          <Text style={styles.cameraButtonText}>Registrar foto</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.deleteButton}
        onPress={onDelete}
        activeOpacity={0.85}
      >
        <Text style={styles.deleteButtonText}>Excluir exercício</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
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
  header: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  titleBlock: {
    flex: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 5,
  },
  description: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
  statusBadge: {
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  completedBadge: {
    backgroundColor: '#DCFCE7',
  },
  pendingBadge: {
    backgroundColor: '#FEF3C7',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '900',
  },
  completedText: {
    color: '#166534',
  },
  pendingText: {
    color: '#92400E',
  },
  photoWrapper: {
    marginBottom: 12,
  },
  image: {
    width: '100%',
    height: 190,
    borderRadius: 18,
  },
  photoBadge: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    backgroundColor: '#111827',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  photoBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  emptyPhoto: {
    width: '100%',
    minHeight: 135,
    borderRadius: 18,
    marginBottom: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 14,
  },
  emptyPhotoIcon: {
    fontSize: 28,
    marginBottom: 6,
  },
  emptyPhotoText: {
    color: '#111827',
    fontWeight: '900',
    marginBottom: 4,
  },
  emptyPhotoSubtext: {
    color: '#6B7280',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#2563EB',
  },
  secondaryButton: {
    backgroundColor: '#EAF2FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13,
  },
  secondaryButtonText: {
    color: '#1D4ED8',
  },
  cameraButton: {
    flex: 1,
    backgroundColor: '#ECFDF5',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  cameraButtonText: {
    color: '#166534',
    fontWeight: '900',
    fontSize: 13,
  },
  deleteButton: {
    marginTop: 10,
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  deleteButtonText: {
    color: '#991B1B',
    fontWeight: '900',
    fontSize: 13,
  },
});