
import { EventEmitter } from 'events';

export class ArchetypeRuntime extends EventEmitter {

	/**
	 * Start executing the given program.
	 */
	public async start(program: string, stopOnEntry: boolean, debug: boolean): Promise<void> {
	}

}