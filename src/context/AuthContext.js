import React, { createContext, useEffect, useState } from 'react';
import { getData, removeData, saveData } from '../utils/storage';

export const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  async function loadUser() {
    try {
      const session = await getData('fitmap_session');

      if (session?.id && session?.email) {
        setUser(session);
      } else {
        setUser(null);
      }
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function login(email, password) {
    const formattedEmail = email.trim().toLowerCase();
    const formattedPassword = password.trim();

    const users = (await getData('fitmap_users')) || [];

    const foundUser = users.find(
      (item) =>
        item.email?.toLowerCase() === formattedEmail &&
        item.password === formattedPassword
    );

    if (!foundUser) {
      throw new Error('E-mail ou senha inválidos.');
    }

    const session = {
      id: foundUser.id,
      name: foundUser.name,
      email: foundUser.email,
    };

    await saveData('fitmap_session', session);
    setUser(session);
  }

  async function register(name, email, password) {
    const formattedName = name.trim();
    const formattedEmail = email.trim().toLowerCase();
    const formattedPassword = password.trim();

    const users = (await getData('fitmap_users')) || [];

    const exists = users.some(
      (item) => item.email?.toLowerCase() === formattedEmail
    );

    if (exists) {
      throw new Error('Já existe uma conta cadastrada com este e-mail.');
    }

    const newUser = {
      id: Date.now().toString(),
      name: formattedName,
      email: formattedEmail,
      password: formattedPassword,
      createdAt: new Date().toISOString(),
    };

    const updatedUsers = [...users, newUser];

    await saveData('fitmap_users', updatedUsers);

    const session = {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
    };

    await saveData('fitmap_session', session);
    setUser(session);
  }

  async function logout() {
    await removeData('fitmap_session');
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}