import AsyncStorage from '@react-native-async-storage/async-storage';
import { KeyValueStore } from './types';

/** On-device store — the MVP default. */
export const asyncStorageStore: KeyValueStore = {
  get: (key) => AsyncStorage.getItem(key),
  set: (key, value) => AsyncStorage.setItem(key, value),
  remove: (key) => AsyncStorage.removeItem(key),
};
