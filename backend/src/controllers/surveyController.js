import { randomUUID } from 'node:crypto'
import { basename } from 'node:path'
import { readManagedFile } from '../services/fileStorage.js'
import {
  createSurvey,
  getSurvey,
  getSurveyPhoto,
  listSurveyors,
  listSurveys,
  reviewSurvey,
  submitSurvey,
  updateSurveyDraft,
  updateSurveySchedule,
  updateSurveyVisitStatus,
  uploadSurveyPhoto,
} from '../services/surveyService.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { HttpError } from '../errors.js'
import { surveyListQuerySchema } from '../validation/surveySchemas.js'

const MAX_PHOTO_BYTES = 5 * 1024 * 1024
const PHOTO_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

function identifyImage(contents, contentType) {
  if (!Buffer.isBuffer(contents) || contents.length === 0) {
    throw new HttpError(400, 'PHOTO_REQUIRED', 'Select a photograph to upload')
  }
  if (contents.length > MAX_PHOTO_BYTES) {
    throw new HttpError(413, 'PHOTO_TOO_LARGE', 'Survey photographs must be 5 MB or smaller')
  }
  if (!Object.hasOwn(PHOTO_TYPES, contentType)) {
    throw new HttpError(415, 'UNSUPPORTED_PHOTO_TYPE', 'Upload a JPEG, PNG, or WebP photograph')
  }
  const isPng = contents.length >= 8
    && contents.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  const isJpeg = contents.length >= 3
    && contents[0] === 0xff && contents[1] === 0xd8 && contents[2] === 0xff
  const isWebp = contents.length >= 12
    && contents.toString('ascii', 0, 4) === 'RIFF'
    && contents.toString('ascii', 8, 12) === 'WEBP'
  if (
    (contentType === 'image/png' && !isPng)
    || (contentType === 'image/jpeg' && !isJpeg)
    || (contentType === 'image/webp' && !isWebp)
  ) {
    throw new HttpError(415, 'PHOTO_CONTENT_TYPE_MISMATCH', 'The photograph content does not match its media type')
  }
  return contentType
}

function safeOriginalName(headerValue, extension) {
  let supplied = typeof headerValue === 'string' ? headerValue : ''
  try {
    supplied = decodeURIComponent(supplied)
  } catch {
    supplied = ''
  }
  const name = basename(supplied.replace(/\\/g, '/'))
    .replace(/[\u0000-\u001f\u007f"]/g, '')
    .trim()
    .slice(0, 245)
  return name || `survey-photo-${randomUUID()}.${extension}`
}

export function createSurveyController({ database, config }) {
  return {
    list: asyncHandler((request, response, next) => {
      const parsed = surveyListQuerySchema.safeParse(request.query)
      if (!parsed.success) return next(parsed.error)
      response.json({ surveys: listSurveys(database, request.user, parsed.data) })
    }),

    listSurveyors: asyncHandler((request, response) => {
      response.json({ surveyors: listSurveyors(database) })
    }),

    get: asyncHandler((request, response) => {
      response.json({ survey: getSurvey(database, request.params.surveyId, request.user) })
    }),

    create: asyncHandler((request, response) => {
      const survey = createSurvey(database, request.validatedBody, request.user)
      response.status(201).json({ survey })
    }),

    updateSchedule: asyncHandler((request, response) => {
      const survey = updateSurveySchedule(
        database,
        request.params.surveyId,
        request.validatedBody,
        request.user,
      )
      response.json({ survey })
    }),

    updateVisitStatus: asyncHandler((request, response) => {
      const survey = updateSurveyVisitStatus(
        database,
        request.params.surveyId,
        request.validatedBody.status,
        request.user,
      )
      response.json({ survey })
    }),

    updateDraft: asyncHandler((request, response) => {
      const survey = updateSurveyDraft(
        database,
        request.params.surveyId,
        request.validatedBody,
        request.user,
      )
      response.json({ survey })
    }),

    submit: asyncHandler((request, response) => {
      const survey = submitSurvey(database, request.params.surveyId, request.user)
      response.json({ survey })
    }),

    review: asyncHandler((request, response) => {
      const survey = reviewSurvey(
        database,
        request.params.surveyId,
        request.validatedBody,
        request.user,
      )
      response.json({ survey })
    }),

    uploadPhoto: asyncHandler(async (request, response) => {
      const contentType = (request.get('content-type') || '').split(';', 1)[0].trim().toLowerCase()
      identifyImage(request.body, contentType)
      const extension = PHOTO_TYPES[contentType]
      const attachmentType = request.get('x-attachment-type') || 'ROOF_PHOTO'
      if (!['ROOF_PHOTO', 'ELECTRICAL_PHOTO', 'OTHER'].includes(attachmentType)) {
        throw new HttpError(400, 'INVALID_ATTACHMENT_TYPE', 'Choose a supported survey photo category')
      }
      const photo = await uploadSurveyPhoto(
        database,
        config.fileStoragePath,
        request.params.surveyId,
        {
          contents: request.body,
          mediaType: contentType,
          originalName: safeOriginalName(request.get('x-file-name'), extension),
          attachmentType,
        },
        request.user,
      )
      response.status(201).json({ photo })
    }),

    getPhoto: asyncHandler(async (request, response) => {
      const photo = getSurveyPhoto(
        database,
        request.params.surveyId,
        request.params.photoId,
        request.user,
      )
      let contents
      try {
        contents = await readManagedFile(config.fileStoragePath, photo.storage_key)
      } catch (error) {
        if (error.code === 'ENOENT') {
          throw new HttpError(404, 'SURVEY_PHOTO_FILE_NOT_FOUND', 'Survey photograph is not available')
        }
        throw error
      }
      const downloadName = encodeURIComponent(photo.original_name)
      response
        .set('Content-Type', photo.media_type)
        .set('Content-Length', String(contents.length))
        .set('Content-Disposition', `inline; filename*=UTF-8''${downloadName}`)
        .set('Cache-Control', 'private, no-store')
        .send(contents)
    }),
  }
}
