/// <reference types="vite/client" />
/// <reference types="domco/env" />

declare namespace NodeJS {
	interface ProcessEnv {
		ALPHA_VANTAGE_API_KEY?: string;
	}
}
