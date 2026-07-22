// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	type GoogleGsi = {
		accounts: {
			id: {
				initialize: (config: {
					client_id: string;
					callback: (response: { credential?: string }) => void;
				}) => void;
				renderButton: (
					parent: HTMLElement,
					options: {
						theme?: string;
						size?: string;
						width?: number;
						text?: string;
						shape?: string;
					}
				) => void;
			};
		};
	};
}

export {};
