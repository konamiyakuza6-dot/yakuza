/**
 * Centralized WebSocket Connection Manager
 * 
 * This is the SINGLE SOURCE OF TRUTH for all WebSocket connections in the application.
 * All tools, tabs, floating windows, and components MUST use this manager instead of
 * creating their own WebSocket connections.
 * 
 * Benefits:
 * - Unified app ID across all connections
 * - Connection pooling and reuse
 * - Consistent error handling
 * - Single point of configuration
 * - Automatic reconnection logic
 */

import { getAppId, getSocketURL } from '@/components/shared/utils/config/config';

export type WsConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
export type WsStatusCallback = (status: WsConnectionStatus, event?: Event) => void;
export type WsMessageCallback = (data: any) => void;

interface WsConnectionConfig {
    appId?: number;
    serverUrl?: string;
    reconnectDelay?: number;
    maxReconnectAttempts?: number;
}

interface WsListener {
    onMessage: WsMessageCallback;
    onStatus?: WsStatusCallback;
}

export class WebSocketConnectionManager {
    private static instance: WebSocketConnectionManager;
    
    private ws: WebSocket | null = null;
    private status: WsConnectionStatus = 'disconnected';
    private messageListeners: Set<WsListener> = new Set();
    private statusListeners: Set<WsStatusCallback> = new Set();
    private reconnectTimeout: NodeJS.Timeout | null = null;
    private reconnectDelay: number = 5000;
    private maxReconnectAttempts: number = 10;
    private reconnectAttempts: number = 0;
    private config: Required<WsConnectionConfig>;
    private messageQueue: Array<{ data: any; timestamp: number }> = [];
    private maxQueueSize: number = 100;
    private lastHeartbeat: number = Date.now();
    private heartbeatInterval: NodeJS.Timeout | null = null;
    private messageId: number = 0;

    private constructor(config: WsConnectionConfig = {}) {
        this.config = {
            appId: config.appId || getAppId(),
            serverUrl: config.serverUrl || getSocketURL(),
            reconnectDelay: config.reconnectDelay || 5000,
            maxReconnectAttempts: config.maxReconnectAttempts || 10,
        };
    }

    /**
     * Get or create the singleton instance
     */
    static getInstance(config?: WsConnectionConfig): WebSocketConnectionManager {
        if (!WebSocketConnectionManager.instance) {
            WebSocketConnectionManager.instance = new WebSocketConnectionManager(config);
        }
        return WebSocketConnectionManager.instance;
    }

    /**
     * Reset the singleton instance (useful for testing)
     */
    static resetInstance(): void {
        if (WebSocketConnectionManager.instance) {
            WebSocketConnectionManager.instance.disconnect();
            WebSocketConnectionManager.instance = undefined as any;
        }
    }

    /**
     * Connect to the WebSocket
     */
    connect(): Promise<void> {
        if (this.ws && (this.status === 'connected' || this.status === 'connecting')) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            try {
                this.setStatus('connecting');
                // Always read live from central config so any change to app ID or server URL is picked up immediately
                const socketUrl = `wss://${getSocketURL()}/websockets/v3?app_id=${getAppId()}`;
                
                this.ws = new WebSocket(socketUrl);

                const onOpenHandler = () => {
                    this.ws?.removeEventListener('open', onOpenHandler);
                    this.ws?.removeEventListener('error', onErrorHandler);
                    
                    this.setStatus('connected');
                    this.reconnectAttempts = 0;
                    this.startHeartbeat();
                    this.flushMessageQueue();
                    
                    resolve();
                };

                const onErrorHandler = () => {
                    this.ws?.removeEventListener('open', onOpenHandler);
                    this.ws?.removeEventListener('error', onErrorHandler);
                    
                    this.setStatus('error');
                    reject(new Error('WebSocket connection failed'));
                };

                this.ws.addEventListener('open', onOpenHandler);
                this.ws.addEventListener('error', onErrorHandler);
                this.ws.addEventListener('message', this.handleMessage.bind(this));
                this.ws.addEventListener('close', this.handleClose.bind(this));
            } catch (error) {
                this.setStatus('error');
                reject(error);
            }
        });
    }

    /**
     * Disconnect from the WebSocket
     */
    disconnect(): void {
        this.clearHeartbeat();
        
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        this.setStatus('disconnected');
        this.messageListeners.clear();
        this.statusListeners.clear();
        this.messageQueue = [];
    }

    /**
     * Subscribe to messages
     */
    onMessage(callback: WsMessageCallback): () => void {
        const listener: WsListener = { onMessage: callback };
        this.messageListeners.add(listener);

        // Auto-connect if not already connected
        if (this.status === 'disconnected') {
            this.connect().catch(err => console.error('Failed to auto-connect', err));
        }

        // Return unsubscribe function
        return () => {
            this.messageListeners.delete(listener);
        };
    }

    /**
     * Subscribe to status changes
     */
    onStatusChange(callback: WsStatusCallback): () => void {
        this.statusListeners.add(callback);
        
        // Call immediately with current status
        callback(this.status);

        // Return unsubscribe function
        return () => {
            this.statusListeners.delete(callback);
        };
    }

    /**
     * Send a message through the WebSocket
     */
    send(data: any): void {
        if (!this.ws || this.status !== 'connected') {
            // Queue the message if not connected
            this.queueMessage(data);
            
            // Try to connect
            if (this.status === 'disconnected') {
                this.connect().catch(err => console.error('Failed to connect', err));
            }
            return;
        }

        try {
            this.ws.send(JSON.stringify(data));
            this.lastHeartbeat = Date.now();
        } catch (error) {
            console.error('Error sending WebSocket message:', error);
            this.queueMessage(data);
        }
    }

    /**
     * Get current connection status
     */
    getStatus(): WsConnectionStatus {
        return this.status;
    }

    /**
     * Check if connected
     */
    isConnected(): boolean {
        return this.status === 'connected' && this.ws?.readyState === WebSocket.OPEN;
    }

    /**
     * Update app ID and reconnect if changed
     */
    updateAppId(newAppId: number): void {
        if (this.config.appId !== newAppId) {
            this.config.appId = newAppId;
            
            // Reconnect with new app ID
            if (this.ws) {
                this.disconnect();
            }
            
            this.reconnectAttempts = 0;
            this.connect().catch(err => console.error('Failed to reconnect with new app ID', err));
        }
    }

    /**
     * Update server URL and reconnect if changed
     */
    updateServerUrl(newServerUrl: string): void {
        if (this.config.serverUrl !== newServerUrl) {
            this.config.serverUrl = newServerUrl;
            
            // Reconnect with new URL
            if (this.ws) {
                this.disconnect();
            }
            
            this.reconnectAttempts = 0;
            this.connect().catch(err => console.error('Failed to reconnect with new server URL', err));
        }
    }

    /**
     * Get message queue length
     */
    getQueueLength(): number {
        return this.messageQueue.length;
    }

    // Private methods

    private setStatus(newStatus: WsConnectionStatus): void {
        if (this.status === newStatus) return;
        
        this.status = newStatus;
        this.statusListeners.forEach(callback => {
            try {
                callback(newStatus);
            } catch (error) {
                console.error('Error in status listener:', error);
            }
        });
    }

    private handleMessage(event: MessageEvent): void {
        try {
            const data = JSON.parse(event.data);
            this.lastHeartbeat = Date.now();

            // Notify all listeners
            this.messageListeners.forEach(listener => {
                try {
                    listener.onMessage(data);
                } catch (error) {
                    console.error('Error in message listener:', error);
                }
            });
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
        }
    }

    private handleClose(): void {
        this.setStatus('disconnected');
        this.startReconnection();
    }

    private startReconnection(): void {
        if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
            this.setStatus('error');
            return;
        }

        this.reconnectAttempts++;
        const delay = this.config.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);

        console.log(`Attempting to reconnect (attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts}) in ${delay}ms`);

        this.reconnectTimeout = setTimeout(() => {
            this.connect().catch(err => console.error('Reconnection failed:', err));
        }, delay);
    }

    private queueMessage(data: any): void {
        if (this.messageQueue.length < this.maxQueueSize) {
            this.messageQueue.push({
                data,
                timestamp: Date.now(),
            });
        } else {
            console.warn('Message queue full, dropping oldest message');
            this.messageQueue.shift();
            this.messageQueue.push({
                data,
                timestamp: Date.now(),
            });
        }
    }

    private flushMessageQueue(): void {
        const now = Date.now();
        const queueToFlush = this.messageQueue.splice(0);

        queueToFlush.forEach(item => {
            const age = now - item.timestamp;
            if (age < 60000) { // Only flush messages less than 1 minute old
                try {
                    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                        this.ws.send(JSON.stringify(item.data));
                    }
                } catch (error) {
                    console.error('Error flushing queued message:', error);
                }
            }
        });
    }

    private startHeartbeat(): void {
        this.clearHeartbeat();
        
        this.heartbeatInterval = setInterval(() => {
            const timeSinceLastHeartbeat = Date.now() - this.lastHeartbeat;
            
            // If no activity for 30 seconds, send a ping
            if (timeSinceLastHeartbeat > 30000) {
                this.send({ ping: Date.now() });
            }
        }, 15000); // Check every 15 seconds
    }

    private clearHeartbeat(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }
}

/**
 * Create a simple connection wrapper for backward compatibility
 */
export class SimpleWebSocketConnection {
    private unsubscribeMessage?: () => void;
    private unsubscribeStatus?: () => void;
    private manager: WebSocketConnectionManager;

    constructor(
        onMessage: (data: any) => void,
        onStatus?: (status: WsConnectionStatus, event?: Event) => void
    ) {
        this.manager = WebSocketConnectionManager.getInstance();
        
        this.unsubscribeMessage = this.manager.onMessage(onMessage);
        
        if (onStatus) {
            this.unsubscribeStatus = this.manager.onStatusChange((status) => {
                onStatus(status);
            });
        }
    }

    send(data: any): void {
        this.manager.send(data);
    }

    close(): void {
        if (this.unsubscribeMessage) this.unsubscribeMessage();
        if (this.unsubscribeStatus) this.unsubscribeStatus();
    }

    isOpen(): boolean {
        return this.manager.isConnected();
    }

    getStatus(): WsConnectionStatus {
        return this.manager.getStatus();
    }
}

export default WebSocketConnectionManager;
