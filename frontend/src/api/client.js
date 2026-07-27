import axios from "axios";

const client = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

/** FormData exige boundary no Content-Type; não enviar application/json. */
client.interceptors.request.use((config) => {
  if (typeof FormData !== "undefined" && config.data instanceof FormData) {
    const h = config.headers;
    if (h?.delete) h.delete("Content-Type");
    else if (h) delete h["Content-Type"];
  }
  return config;
});

export function setAuthToken(token) {
  if (token) {
    client.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete client.defaults.headers.common.Authorization;
  }
}

export default client;
