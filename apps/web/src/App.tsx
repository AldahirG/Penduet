import { Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { Design } from './pages/Design'
import { Draw } from './pages/Draw'
import { Home } from './pages/Home'
import { Lesson } from './pages/Lesson'
import { Lessons } from './pages/Lessons'
import { NotFound } from './pages/NotFound'
import { Room } from './pages/Room'
import { Settings } from './pages/Settings'
import { Together } from './pages/Together'

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Home />} />
        <Route path="together" element={<Together />} />
        <Route path="room/:code" element={<Room />} />
        <Route path="lessons" element={<Lessons />} />
        <Route path="lesson/:slug" element={<Lesson />} />
        <Route path="draw" element={<Draw />} />
        <Route path="settings" element={<Settings />} />
        <Route path="design" element={<Design />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
