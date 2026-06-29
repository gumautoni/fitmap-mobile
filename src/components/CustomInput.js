import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

export default function CustomInput({
  style,
  multiline = false,
  ...props
}) {
  return (
    <View style={styles.wrapper}>
      <TextInput
        {...props}
        style={[
          styles.input,
          multiline && styles.multilineInput,
          style,
        ]}
        placeholderTextColor="#9CA3AF"
        multiline={multiline}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 14,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 16,
    paddingHorizontal: 15,
    paddingVertical: 14,
    fontSize: 15,
    color: '#111827',
    fontWeight: '600',
  },
  multilineInput: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
});