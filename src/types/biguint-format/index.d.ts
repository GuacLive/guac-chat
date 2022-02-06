// Type definitions for biguint-format
// Project: https://github.com/T-PWK/biguint-format
// Definitions by: Seth Stephens <https://github.com/FNCxPro>

/// <reference types="node" />

declare module 'biguint-format' {
	interface BUIFOptions {
	  format?: string;
	}
	interface BUIF {
	  (
		buffer: Buffer,
		base?: 'dec' | 'hex' | 'bin' | 'oct',
		options?: BUIFOptions
	  ): string;
	}
	var buif: BUIF;
	export = buif;
  }