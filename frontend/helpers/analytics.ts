interface Umami {
    track(eventName?: string, data?: Record<string, unknown>): void
}

declare global {
    interface Window {
        umami?: Umami
    }
}

export function countEvent(eventName: string, data?: Record<string, unknown>) {
    window.umami?.track(eventName, data)
}
