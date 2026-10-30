"""Original low-level score and timed English narration captions; no sampled music."""
import numpy as np,wave,json
from pathlib import Path
sr=48000;t=np.arange(30*sr)/sr;rng=np.random.default_rng(42);sound=np.zeros(len(t))
chords=[(0,7.8,[146.83,220,293.66,369.99]),(7.4,15.2,[123.47,185,246.94,293.66]),(14.8,23.5,[98,146.83,196,246.94]),(23,30,[146.83,220,293.66,369.99])]
for a,b,notes in chords:
 env=np.minimum(np.clip((t-a)/1.7,0,1),np.clip((b-t)/2,0,1));tone=sum((np.sin(2*np.pi*f*t+i*.6)+.18*np.sin(2*np.pi*f*2*t+i)) for i,f in enumerate(notes))/len(notes)
 sound+=tone*env*.013
for at in [4.5,9.1,12.8,18.5,23.3]:
 u=t-at;env=np.exp(-((u-.08)/.15)**2);noise=rng.normal(0,1,len(t));smooth=np.convolve(noise,np.ones(50)/50,mode='same');sound+=smooth*env*.02
for at,f in [(23.7,587.33),(24,739.99),(24.3,880)]:
 u=t-at;env=(u>=0)*np.exp(-np.maximum(u,0)*3);sound+=np.sin(2*np.pi*f*u)*env*.009
sound*=np.clip(t/.4,0,1)*np.clip((30-t)/1.2,0,1)
stereo=np.column_stack((sound,sound*.96));pcm=np.clip(stereo*32767,-32768,32767).astype('<i2')
with wave.open('assets/motion/findbox-original-score.wav','wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(sr);w.writeframes(pcm.tobytes())
def ts(s):
 ms=round(s*1000);return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02}.{ms%1000:03}'
boundaries=json.loads(Path('assets/motion/narration-timing.json').read_text())
lines=['WEBVTT','']
for i,b in enumerate(boundaries):
 start=b['offset']/1e7+.25;end=min(29.8,start+b['duration']/1e7)
 lines += [str(i+1),ts(start)+' --> '+ts(end),b['text'].replace('Find Box','FindBox'),'']
Path('public/media/films/findbox-explainer-v1.vtt').write_text('\n'.join(lines),encoding='utf-8')
print('Original score and narration captions ready.')
