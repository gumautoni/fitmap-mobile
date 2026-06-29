import AsyncStorage from '@react-native-async-storage/async-storage';

export async function saveData(key, value) {
  try {
    const jsonValue = JSON.stringify(value);
    await AsyncStorage.setItem(key, jsonValue);
  } catch (error) {
    console.log(`Erro ao salvar dados em ${key}:`, error);
    throw new Error('Não foi possível salvar os dados.');
  }
}

export async function getData(key) {
  try {
    const value = await AsyncStorage.getItem(key);

    if (!value) {
      return null;
    }

    return JSON.parse(value);
  } catch (error) {
    console.log(`Erro ao buscar dados em ${key}:`, error);
    return null;
  }
}

export async function removeData(key) {
  try {
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.log(`Erro ao remover dados de ${key}:`, error);
    throw new Error('Não foi possível remover os dados.');
  }
}

export async function clearAllData() {
  try {
    await AsyncStorage.clear();
  } catch (error) {
    console.log('Erro ao limpar armazenamento:', error);
    throw new Error('Não foi possível limpar os dados do aplicativo.');
  }
}