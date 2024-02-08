import z, { number } from 'zod'
import { prisma } from '../../lib/prisma'
import { FastifyInstance } from 'fastify'
import { redis } from '../../lib/redis'

export async function getPoll(app: FastifyInstance) {
  app.get('/polls/:pollId' , async (request, reply) =>{
    const getPollParams = z.object({
      pollId: z.string().uuid(),
    })
  
    const { pollId } = getPollParams.parse(request.params)
  
    const poll = await prisma.poll.findUnique({
      where: {
        id: pollId,
      },
      include:{
        options: {
          select:{
            id: true,
            title: true,
          }
        }
        }
    })

    if(!poll){
      return reply.status(400).send({ message: 'Poll not found' })
    }

    const result = await redis.zrange(pollId, 0, -1, 'WITHSCORES')//Retornar o rank daquela chave comecar do rank 0 ate ao -1 se caso quiser so top 3 é so trocar o -1 por 3

    //Convert Array
    const votes = result.reduce((obj, line, index) => {
      if(index % 2 === 0){
        const score = result[index + 1]

        Object.assign(obj, { [line]:Number(score) }) //MEsclar as 2 linhas
      }

      return obj
    }, {} as Record<string, number>)
  
    return reply.send({ 
      poll:{
        id: poll.id,
        title: poll.title,
        option:poll.options.map(option => {
          return{
            id:option.id,
            title:option.title,
            score: (option.id in votes) ? votes[option.id] : 0
          }
        })
      }
     })
  })
}