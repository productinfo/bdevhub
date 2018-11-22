import axios, { AxiosResponse } from 'axios'
import { REHYDRATE } from 'redux-persist'
import { all, call, put, select, takeLatest } from 'redux-saga/effects'

import {
  ExtractActionFromActionCreator,
  GitHubUser,
} from 'shared-core/dist/types'
import * as github from '../../libs/github'
import * as actions from '../actions'
import * as selectors from '../selectors'

function* onRehydrate() {
  const token = yield select(selectors.tokenSelector)
  if (token) yield put(actions.loginRequest({ token }))
}

function* onLoginRequest(
  action: ExtractActionFromActionCreator<typeof actions.loginRequest>,
) {
  github.authenticate(action.payload.token || '')

  try {
    const { data }: AxiosResponse<{ user: GitHubUser }> = yield axios.post(
      '/api/auth',
      {
        githubToken: action.payload.token,
      },
    )

    if (!(data && data.user)) throw new Error('Invalid response')

    yield put(actions.loginSuccess({ user: data.user }))
    return
  } catch (error) {
    console.error(error.response)

    if (error && error.response && error.response.status === 401) {
      yield put(actions.loginFailure(error.response.data))
      return
    }
  }

  try {
    const response = yield call(github.octokit.users.get, {})
    const user = response.data as GitHubUser
    if (!(user && user.id && user.login)) throw new Error('Invalid response')

    yield put(actions.loginSuccess({ user }))
  } catch (error) {
    yield put(actions.loginFailure(error))
  }
}

function* onLoginFailure(
  action: ExtractActionFromActionCreator<typeof actions.loginFailure>,
) {
  if (action.error.code === 401) yield put(actions.logout())
}

function onLogout() {
  github.authenticate('')
}

export function* authSagas() {
  yield all([
    yield takeLatest(REHYDRATE, onRehydrate),
    yield takeLatest('LOGIN_FAILURE', onLoginFailure),
    yield takeLatest('LOGIN_REQUEST', onLoginRequest),
    yield takeLatest('LOGOUT', onLogout),
  ])
}