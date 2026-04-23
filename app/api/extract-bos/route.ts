import { NextRequest, NextResponse } from 'next/server'

function parseMultipart(body: Buffer, boundary: string) {
  const parts: { name: string; filename: string; data: Buffer }[] = []
  const boundaryBuf = Buffer.from('--' + boundary)

  let start = body.indexOf(boundaryBuf) + boundaryBuf.length + 2

  while (start < body.length) {
    const end = body.indexOf(boundaryBuf, start)
    if (end === -1) break

    const part = body.slice(start, end - 2)
    const headerEnd = part.indexOf('\r\n\r\n')
    if (headerEnd === -1) { start = end + boundaryBuf.length + 2; continue }

    const headerStr = part.slice(0, headerEnd).toString()
    const data = part.slice(headerEnd + 4)

    const nameMatch = headerStr.match(/name="([^"]+)"/)
    const filenameMatch = headerStr.match(/filename="([^"]+)"/)

    parts.push({
      name: nameMatch?.[1] || '',
      filename: filenameMatch?.[1] || '',
      data,
    })

    start = end + boundaryBuf.length + 2
  }
  return parts
}

export async function POST(req: NextRequest) {
  const secret = process.env.SYNC_SECRET
  const authHeader = req.headers.get('authorization')
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const contentType = req.headers.get('content-type') || ''
    const boundaryMatch = contentType.match(/boundary=(.+)/)
    if (!boundaryMatch) return NextResponse.json({ error: 'No multipart boundary' }, { status: 400 })

    const body = Buffer.from(await req.arrayBuffer())
    const boundary = boundaryMatch[1]
    const parts = parseMultipart(body, boundary)
    const filePart = parts.find(p => p.name === 'file')

    if (!filePart) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

    const base64Pdf = filePart.data.toString('base64')

    const geminiKey = process.env.GEMINI_API_KEY
    if (!geminiKey) return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })

    const isCSV = filePart.filename?.toLowerCase().endsWith('.csv') || filePart.filename?.toLowerCase().endsWith('.txt')

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              isCSV
                ? { text: `CSV DATA:\n${filePart.data.toString('utf8')}` }
                : { inlineData: { mimeType: 'application/pdf', data: base64Pdf } },
              {
                text: `Extract the Board of Studies (BOS) curriculum from this document.

Return ONLY valid JSON in this exact format:
{
  "name": "Detected BOS name or program name",
  "program": "B.Tech or detected program",
  "semesters": [
    {
      "semester": 1,
      "subjects": [
        {
          "subject_code": "CS101",
          "subject_name": "Engineering Mathematics I",
          "category": "BSC",
          "lecture_hours": 3,
          "tutorial_hours": 0,
          "practical_hours": 0,
          "is_elective": false,
          "topics": ["Topic 1", "Topic 2"]
        }
      ]
    }
  ]
}

Rules:
- Extract ALL semesters and ALL subjects
- L-T-P: lecture_hours, tutorial_hours, practical_hours are CREDITS (not hours). They are the source of truth.
- NEVER put anything in tutorial_hours unless the document explicitly says Tutorial. Default T=0.
- If only total credits given for a THEORY subject: set L=credits, T=0, P=0
- If only total credits given for a LAB subject: set L=0, T=0, P=credits
- If theory + lab rows exist for same subject: MERGE into ONE subject. Theory credits → L. Lab credits → P.
- Category: Map to AICTE codes: HSS, BSC, ESC, PCC, PEC, OEC, PrSI, AUC. If unsure use PCC.
- Topics: Extract if listed, else empty array.
- subject_code: Use from document. If none, generate as "SEM1-01" etc.
- Return ONLY the JSON object.`
              }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 65536,
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingBudget: 0 },
          }
        })
      }
    )

    const geminiData = await geminiRes.json()

    if (!geminiRes.ok) {
      return NextResponse.json({ error: 'Gemini API error', details: geminiData.error?.message }, { status: 500 })
    }

    let text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || ''
    if (!text) {
      return NextResponse.json({ error: 'Empty response from Gemini' }, { status: 422 })
    }

    text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()

    let parsed
    try {
      parsed = JSON.parse(text)
    } catch {
      return NextResponse.json({ error: 'Failed to parse Gemini response as JSON', preview: text.slice(0, 500) }, { status: 422 })
    }

    return NextResponse.json({ ok: true, data: parsed })
  } catch (err: any) {
    console.error('Extract BOS error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
