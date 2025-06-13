import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Spid from "./pages/Spid";
import Dashboard from "./pages/Dashboard";
import DocumentReview from "./pages/DocumentReview";
import DocumentRegister from "./pages/DocumentRegister";
import SpidCanvas from "./pages/SpidCanvas";
import TagRegister from "./pages/TagRegister";
import Tagreview from "./pages/Tagreview";
import PageNotFound from "./components/PageNotFound";
import TreeRegister from "./pages/TreeReview";
import BulkModelImport from "./pages/BulkModalImport";
import CommentReview from "./pages/CommentReview";
import CommentStatusTable from "./pages/CommentStatusTable";

// import Login from './pages/Login';

function App() {
  return (
    <Routes>
      {/* <Route path="/login" element={<Login />} /> */}

      {/* All pages that use the shared layout */}
      <Route element={<Home />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/spid" element={<Spid />} />
        <Route path="/documents/review" element={<DocumentReview />} />
        <Route path="/documents/register" element={<DocumentRegister />} />
        <Route path="/canvas/:id" element={<SpidCanvas />} />
        <Route path="/tags/register" element={<TagRegister />} />
        <Route path="/tags/review" element={<Tagreview />} />
        <Route path="/tree-management/review" element={<TreeRegister />} />
        <Route path="/bulk-model-import" element={<BulkModelImport />} />
        <Route path="/comment-review" element={<CommentReview />} />
        <Route path="/comment-status" element={<CommentStatusTable />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
}

export default App;
