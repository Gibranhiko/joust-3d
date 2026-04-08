import { GameEngine } from './GameEngine';

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const engine = new GameEngine(canvas);
engine.start();
