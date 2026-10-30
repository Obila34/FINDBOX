import asyncio,json
from pathlib import Path
import edge_tts,imageio_ffmpeg
text='Meet Find Box. We give everyday belongings a way home. Smart labels connect families to a private, school-supported return system. For parents, that means less searching and clearer updates. For schools, one workspace brings students, collection points, and verified handovers together. From a missing bottle to a happy reunion, Find Box keeps your community connected. Find Box dot Africa. A little less lost. A lot more found.'
async def main():
 voice=edge_tts.Communicate(text,'en-KE-ChilembaNeural',rate='+8%',pitch='-2Hz')
 words=[]
 with open('assets/motion/findbox-narration-original.mp3','wb') as f:
  async for chunk in voice.stream():
   if chunk['type']=='audio':f.write(chunk['data'])
   elif chunk['type'] in ('WordBoundary','SentenceBoundary'):words.append(chunk)
 Path('assets/motion/narration-timing.json').write_text(json.dumps(words),encoding='utf-8')
 Path('assets/motion/narration-script.txt').write_text(text,encoding='utf-8')
 print('Narration ready; words',len(text.split()))
 print('Narration saved. The renderer checks duration before muxing.')
asyncio.run(main())
