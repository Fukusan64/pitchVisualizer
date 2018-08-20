const audioCtx = new AudioContext();

class Analyser {
  constructor(fftSize = 2048, smoothingTimeConstant = 0.5) {
    this.node = audioCtx.createAnalyser();
    this.node.fftSize = fftSize;
    this.node.smoothingTimeConstant = smoothingTimeConstant;
    this.data = {
      buffer: new Uint8Array(this.node.frequencyBinCount),
      lmaxIndex: 0,
      rmaxIndex: this.node.frequencyBinCount - 1,
      maxFrequencyData: {
        maxFrequency: 0,
        oct: 0,
        pitch: 0,
      },
    }
  }
  update() {
    this.node.getByteFrequencyData(this.data.buffer);
    let lmaxIndex = 0;
    let rmaxIndex = this.data.buffer.length - 1;
    for(let i = 0; i < this.data.buffer.length; i++) {
      if (this.data.buffer[lmaxIndex] < this.data.buffer[i])lmaxIndex = i;
      if (this.data.buffer[rmaxIndex] < this.data.buffer[this.data.buffer.length - 1 - i])rmaxIndex = this.data.buffer.length - 1 - i;
    }
    this.data.lmaxIndex = lmaxIndex;
    this.data.rmaxIndex = rmaxIndex;

    const maxFrequency = (lmaxIndex + rmaxIndex) / 2 * audioCtx.sampleRate / this.node.fftSize;
    const C4 = 261.626;
    const p = Math.round(Math.log2(maxFrequency / C4) * 12);
    this.data.maxFrequencyData.maxFrequency = maxFrequency;
    this.data.maxFrequencyData.oct = Math.floor(p / 12);
    this.data.maxFrequencyData.pitch = (() => {
      const pmod12 = p % 12;
      return pmod12 >= 0 ? pmod12 : pmod12 + 12;
    })();
  }
}

class Visualizer {
  constructor(size, dataMax) {
    this.pitchNames = 'ド,ド#,レ,レ#,ミ,ファ,ファ#,ソ,ソ#,ラ,ラ#,シ'.split(',');
    this.size = size;
    this.dataMax = dataMax;
    this.ctx = document.getElementById('mainCanvas').getContext('2d');
    [this.ctx.canvas.width, this.ctx.canvas.height] = [innerWidth, innerHeight];
    let resizeTimerIDArray = [];
    window.addEventListener('resize', () => {
      while (resizeTimerIDArray.length !== 0) {
        clearTimeout(resizeTimerIDArray.shift());
      }
      resizeTimerIDArray.push(setTimeout(() => {
        [this.ctx.canvas.width, this.ctx.canvas.height] = [innerWidth, innerHeight];
      }, 100));
    });
  }
  update(data) {
    const [w, h] = [this.ctx.canvas.width, this.ctx.canvas.height];
    this.ctx.clearRect(0, 0, w, h);
    const padding = w / this.size;
    this.ctx.strokeStyle = 'gray';
    this.ctx.beginPath();
    this.ctx.moveTo(0, h * (1 - data.buffer[0] / this.dataMax));
    for(let i = 1;i < this.size;i++) {
      this.ctx.lineTo(i * padding, h * (1 - data.buffer[i] / this.dataMax));
    }
    this.ctx.stroke();
    this.ctx.fillStyle = 'red';
    this.ctx.beginPath();
    this.ctx.arc(
      data.rmaxIndex * padding,
      h * (1 - data.buffer[data.rmaxIndex] / this.dataMax),
      3, 0, 2 * Math.PI
    );
    this.ctx.fill();
    this.ctx.beginPath();
    this.ctx.arc(
      data.lmaxIndex * padding,
      h * (1 - data.buffer[data.lmaxIndex] / this.dataMax),
      3, 0, 2 * Math.PI
    );
    this.ctx.fill();
    this.ctx.fillStyle = 'white';
    this.ctx.textBaseline = 'bottom';
    this.ctx.textAlign = 'end';
    const fontSize = 48;

    const MFD = data.maxFrequencyData;
    this.ctx.font = `${fontSize}px monospaced`;
    this.ctx.fillText(
      `${this.pitchNames[MFD.pitch]}(${MFD.oct === -0 ? 0 : MFD.oct})`,
      w / 2, h / 2
    );
  }
}

class Mic {
  constructor() {
    this.node = null;
  }
  async setUp() {
    try{
      const streamSorce = audioCtx.createMediaStreamSource(
        await new Promise((resolve, reject) => {
          navigator.getUserMedia({audio: true}, stream => resolve(stream), err => reject(err))
        })
      );
      this.node = audioCtx.createGain();
      streamSorce.connect(this.node);
      this.node.gain.setValueAtTime(0.1, audioCtx.currentTime);
    }catch(e) {
      console.error(e);
    }
  }
  connect(node) {
    this.node.connect(node);
  }
  setGain(gain) {
    this.node.gain.setValueAtTime(gain, audioCtx.currentTime);
  }
}

const main = async () => {
  const mic = new Mic();
  const analyser = new Analyser(2 ** 12, 0.7);
  const visualizer = new Visualizer(analyser.node.frequencyBinCount, 2 ** 8);
  const stats = new Stats();
  stats.dom.style.position = "fixed";
  stats.dom.style.right  = "5px";
  stats.dom.style.top = "5px";
  document.body.appendChild(stats.dom);
  // TODO: 各種イベントを実装
  // gain
  // minDecibels
  // smoothingTimeConstant

  await mic.setUp();
  mic.connect(analyser.node);
  const updater = () => {
    analyser.update();
    visualizer.update(analyser.data);
    stats.update();
    requestAnimationFrame(updater);
  };
  updater();
};

window.onload = main;
