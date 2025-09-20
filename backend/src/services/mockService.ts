import { logger } from '../utils/logger'
import { TranscriptionSegment, TranscriptionOptions } from '../types'

class MockService {
  async mockTranscription(
    audioBuffer: Buffer,
    options: TranscriptionOptions
  ): Promise<{
    text: string
    segments?: TranscriptionSegment[]
    confidence: number
    language: string
  }> {
    logger.info('Using mock transcription service for development')

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000))

    // Generate mock medical/therapy content
    const mockTexts = [
      "本日は理学療法における運動療法の基礎についてお話しします。まず肩甲骨の動きから確認していきましょう。",
      "変形性膝関節症の患者様に対するアプローチとして、まずROM測定を行い、その後適切なエクササイズを選択します。",
      "仙腸関節の機能障害は腰痛の原因となることが多く、評価と治療が重要です。今回はその詳細について説明します。",
      "肩関節周囲炎、いわゆる五十肩の病態理解と段階的な運動療法プログラムについて解説していきます。",
      "ACL損傷後のリハビリテーションでは、段階的な荷重と運動強度の調整が重要になります。",
    ]

    const selectedText = mockTexts[Math.floor(Math.random() * mockTexts.length)]

    let segments: TranscriptionSegment[] | undefined

    if (options.includeTimestamps) {
      // Split text into segments with mock timestamps
      const words = selectedText.split('。').filter(sentence => sentence.trim())
      let currentTime = 0

      segments = words.map((sentence, index) => {
        const duration = 3 + Math.random() * 4 // 3-7 seconds per sentence
        const segment: TranscriptionSegment = {
          start: currentTime,
          end: currentTime + duration,
          text: sentence.trim() + (sentence.trim() ? '。' : ''),
        }

        if (options.speakerDetection && index % 3 === 0) {
          segment.speaker = index % 6 === 0 ? '講師' : '質問者'
        }

        currentTime += duration + 0.5 // Small pause between sentences
        return segment
      })
    }

    // Mock confidence score
    const confidence = 0.85 + Math.random() * 0.1 // 85-95%

    return {
      text: selectedText,
      segments,
      confidence,
      language: options.language === 'en' ? 'en' : 'ja',
    }
  }

  shouldUseMock(): boolean {
    // Use mock if OpenAI API key is not provided or is placeholder
    const apiKey = process.env.OPENAI_API_KEY
    return !apiKey || apiKey === 'your-openai-api-key-here' || process.env.NODE_ENV === 'development'
  }
}

export const mockService = new MockService()