// ADAPT: question tool pauses execute until UI answers (OpenCode Question.ask stand-in)

import { z } from 'zod'
import type { AgentToolDef } from './types'
import description from '../vendor/opencode/tools/question.txt?raw'
import type { QuestionPrompt } from '../session/store'

const optionSchema = z.object({
  label: z.string().describe('Display text (1-5 words, concise)'),
  description: z.string().optional().describe('Explanation of choice'),
})

const questionSchema = z.object({
  question: z.string().describe('Complete question'),
  header: z.string().optional().describe('Very short label (max 30 chars)'),
  options: z.array(optionSchema).describe('Available choices'),
  multiple: z.boolean().optional().describe('Allow selecting multiple choices'),
  custom: z.boolean().optional().describe('Allow typing a custom answer (default: true)'),
})

export const questionTool: AgentToolDef = {
  id: 'question',
  description: description.trim(),
  parameters: z.object({
    questions: z.array(questionSchema).describe('Questions to ask'),
  }),
  execute: async (args, ctx) => {
    const { questions } = args as { questions: QuestionPrompt[] }
    if (!questions.length) {
      throw new Error('At least one question is required')
    }

    const answers = await ctx.askQuestion(
      questions.map((q) => ({
        ...q,
        custom: q.custom !== false,
      })),
    )

    const formatted = questions
      .map((q, i) => `"${q.question}"="${answers[i]?.length ? answers[i].join(', ') : 'Unanswered'}"`)
      .join(', ')

    return {
      title: `Asked ${questions.length} question${questions.length > 1 ? 's' : ''}`,
      output: `User has answered your questions: ${formatted}. You can now continue with the user's answers in mind.`,
    }
  },
}
