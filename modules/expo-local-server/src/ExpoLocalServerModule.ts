import { requireNativeModule, type EventSubscription } from 'expo-modules-core';

interface HttpRequest {
  id: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  body: string;
}

interface WebSocketConnectEvent {
  clientId: string;
}

interface WebSocketMessageEvent {
  clientId: string;
  message: string;
}

interface WebSocketDisconnectEvent {
  clientId: string;
}

const ExpoLocalServer = requireNativeModule('ExpoLocalServer');

export async function startServer(port: number): Promise<{ url: string }> {
  return await ExpoLocalServer.startServer(port);
}

export async function stopServer(): Promise<void> {
  return await ExpoLocalServer.stopServer();
}

export function onRequest(
  callback: (request: HttpRequest) => void
): EventSubscription {
  return ExpoLocalServer.addListener('onRequest', callback);
}

export function sendResponse(
  requestId: string,
  statusCode: number,
  headers: Record<string, string>,
  body: string
): void {
  ExpoLocalServer.sendResponse(requestId, statusCode, headers, body);
}

export function sendFileResponse(
  requestId: string,
  statusCode: number,
  headers: Record<string, string>,
  filePath: string
): void {
  ExpoLocalServer.sendFileResponse(requestId, statusCode, headers, filePath);
}

export function onWebSocketConnect(
  callback: (event: WebSocketConnectEvent) => void
): EventSubscription {
  return ExpoLocalServer.addListener('onWebSocketConnect', callback);
}

export function onWebSocketMessage(
  callback: (event: WebSocketMessageEvent) => void
): EventSubscription {
  return ExpoLocalServer.addListener('onWebSocketMessage', callback);
}

export function onWebSocketDisconnect(
  callback: (event: WebSocketDisconnectEvent) => void
): EventSubscription {
  return ExpoLocalServer.addListener('onWebSocketDisconnect', callback);
}

export function sendWebSocketMessage(
  clientId: string,
  message: string
): void {
  ExpoLocalServer.sendWebSocketMessage(clientId, message);
}

export function broadcastWebSocket(message: string): void {
  ExpoLocalServer.broadcastWebSocket(message);
}

export async function getLocalIpAddress(): Promise<string> {
  return await ExpoLocalServer.getLocalIpAddress();
}

export function startForegroundService(): void {
  ExpoLocalServer.startForegroundService();
}

export function stopForegroundService(): void {
  ExpoLocalServer.stopForegroundService();
}

export function startBackgroundKeepAlive(): void {
  ExpoLocalServer.startBackgroundKeepAlive();
}

export function stopBackgroundKeepAlive(): void {
  ExpoLocalServer.stopBackgroundKeepAlive();
}
