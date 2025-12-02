import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle, AlertCircle, Github, Link2, Unlink2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

interface GitHubRepo {
  name: string;
  owner: string;
  url: string;
  private: boolean;
}

interface GitHubBranch {
  name: string;
}

export default function GitHubPage() {
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>("");
  const [selectedBranch, setSelectedBranch] = useState<string>("main");
  const [commitMessage, setCommitMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<any>(null);
  const [loadingRepos, setLoadingRepos] = useState(true);
  const [fileChanges, setFileChanges] = useState<any>(null);
  const [loadingChanges, setLoadingChanges] = useState(false);
  const [linkedRepo, setLinkedRepo] = useState<any>(null);
  const [loadingLinked, setLoadingLinked] = useState(true);
  const [linkingLoading, setLinkingLoading] = useState(false);
  const [showCommitForm, setShowCommitForm] = useState(false);

  useEffect(() => {
    loadGitHubInfo();
    loadFileChanges();
    loadLinkedRepo();
  }, []);

  const loadFileChanges = async () => {
    try {
      setLoadingChanges(true);
      const res = await fetch("/api/github/changes");
      const data = await res.json();
      setFileChanges(data);
    } catch (error) {
      console.error("Failed to load file changes:", error);
    } finally {
      setLoadingChanges(false);
    }
  };

  const loadLinkedRepo = async () => {
    try {
      const res = await fetch("/api/github/linked-repo");
      const data = await res.json();
      setLinkedRepo(data);
      if (data.status === "linked") {
        setSelectedRepo(`${data.owner}/${data.repo}`);
      }
    } catch (error) {
      console.error("Failed to load linked repo:", error);
    } finally {
      setLoadingLinked(false);
    }
  };

  const handleLinkRepo = async () => {
    if (!selectedRepo || !selectedRepo.includes("/")) {
      toast.error("اختر مستودع صحيح");
      return;
    }
    const [owner, repo] = selectedRepo.split("/");
    setLinkingLoading(true);
    try {
      const res = await fetch("/api/github/link-repo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, repo }),
      });
      if (res.ok) {
        toast.success("✓ تم ربط المستودع بنجاح!");
        await loadLinkedRepo();
      } else {
        toast.error("فشل ربط المستودع");
      }
    } catch (error) {
      console.error("Link failed:", error);
      toast.error("خطأ: فشل ربط المستودع");
    } finally {
      setLinkingLoading(false);
    }
  };

  const handleUnlinkRepo = async () => {
    setLinkingLoading(true);
    try {
      const res = await fetch("/api/github/unlink-repo", { method: "POST" });
      if (res.ok) {
        toast.success("✓ تم إلغاء الربط بنجاح!");
        setLinkedRepo(null);
        setSelectedRepo("");
      } else {
        toast.error("فشل إلغاء الربط");
      }
    } catch (error) {
      console.error("Unlink failed:", error);
      toast.error("خطأ: فشل إلغاء الربط");
    } finally {
      setLinkingLoading(false);
    }
  };

  const loadGitHubInfo = async () => {
    try {
      setLoadingRepos(true);
      const infoRes = await fetch("/api/github/info");
      const infoData = await infoRes.json();
      setInfo(infoData);

      const [reposRes, branchesRes] = await Promise.all([
        fetch("/api/github/repos"),
        fetch("/api/github/branches"),
      ]);

      const reposData = await reposRes.json();
      const branchesData = await branchesRes.json();
      
      const validRepos = (reposData.repos || []).filter((r: any) => r.owner && r.name);
      setRepos(validRepos);
      setBranches(branchesData.branches || ["main"]);
      
      if (infoData.owner && infoData.repo) {
        const defaultValue = `${infoData.owner}/${infoData.repo}`;
        setSelectedRepo(defaultValue);
      }
    } catch (error) {
      console.error("Failed to load GitHub info:", error);
      toast.error("فشل تحميل معلومات GitHub");
    } finally {
      setLoadingRepos(false);
    }
  };

  const handlePush = async () => {
    if (!commitMessage.trim()) {
      toast.error("أدخل رسالة commit");
      return;
    }

    if (!selectedRepo) {
      toast.error("حدد مستودع");
      return;
    }

    setLoading(true);
    try {
      if (!selectedRepo || !selectedRepo.includes("/")) {
        toast.error("يجب اختيار مستودع صحيح");
        setLoading(false);
        return;
      }
      
      const parts = selectedRepo.split("/");
      let owner = parts[0]?.trim();
      let repo = parts[1]?.trim();
      
      if (!owner || owner === "undefined" || !repo || repo === "undefined") {
        toast.error("بيانات المستودع غير صحيحة - الرجاء اختيار مرة أخرى");
        setLoading(false);
        return;
      }
      
      const res = await fetch("/api/github/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: commitMessage,
          owner,
          repo,
          branch: selectedBranch,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success("✓ تم دفع التغييرات إلى GitHub بنجاح!");
        setCommitMessage("");
        setShowCommitForm(false);
        await loadFileChanges(); // تحديث قائمة التغييرات
      } else {
        toast.error(data.error || "فشل دفع التغييرات");
      }
    } catch (error) {
      console.error("Push failed:", error);
      toast.error("خطأ: فشل دفع التغييرات");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="github-page">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3" data-testid="heading-github">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
            <Github className="w-6 h-6 text-white" />
          </div>
          GitHub Integration
        </h1>
        <p className="text-gray-400 mt-2">ربط وتزامن المشروع مع GitHub بسهولة وأمان</p>
      </div>

      {/* Status Card */}
      <Card className="border border-blue-500/20 bg-gradient-to-r from-blue-500/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            {info?.status === "connected" ? (
              <>
                <CheckCircle className="w-5 h-5 text-green-500" />
                متصل بـ GitHub
              </>
            ) : (
              <>
                <AlertCircle className="w-5 h-5 text-yellow-500" />
                لم يتم توصيل GitHub
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {info?.status === "connected" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-xs text-gray-400 uppercase tracking-wider">اسم المستخدم</p>
                <p className="text-sm font-mono bg-gray-900/50 px-3 py-2 rounded border border-gray-700">
                  {info.owner}
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-gray-400 uppercase tracking-wider">المستودع الافتراضي</p>
                <p className="text-sm font-mono bg-gray-900/50 px-3 py-2 rounded border border-gray-700">
                  {info.repo}
                </p>
              </div>
            </div>
          ) : (
            <Alert className="bg-yellow-500/10 border-yellow-500/30">
              <AlertDescription className="text-yellow-200">
                تأكد من تفعيل GitHub connector في إعدادات Replit
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* File Changes Summary */}
      {fileChanges && (
        <Card className="border border-purple-500/20 bg-gradient-to-r from-purple-500/5 to-transparent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              📝 ملخص التغييرات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm text-gray-300 font-medium">
                {fileChanges.summary || "لا توجد تغييرات"}
              </p>
              {fileChanges.changes && (
                <div className="flex flex-wrap gap-4 mt-4 text-sm">
                  {fileChanges.changes.modified.length > 0 && (
                    <div className="flex items-center gap-2 bg-blue-500/10 px-3 py-1.5 rounded border border-blue-500/20">
                      <span className="text-blue-400">✏️</span>
                      <span className="text-blue-300">معدلة: {fileChanges.changes.modified.length}</span>
                    </div>
                  )}
                  {fileChanges.changes.created.length > 0 && (
                    <div className="flex items-center gap-2 bg-green-500/10 px-3 py-1.5 rounded border border-green-500/20">
                      <span className="text-green-400">✨</span>
                      <span className="text-green-300">جديدة: {fileChanges.changes.created.length}</span>
                    </div>
                  )}
                  {fileChanges.changes.deleted.length > 0 && (
                    <div className="flex items-center gap-2 bg-red-500/10 px-3 py-1.5 rounded border border-red-500/20">
                      <span className="text-red-400">🗑️</span>
                      <span className="text-red-300">محذوفة: {fileChanges.changes.deleted.length}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Push to GitHub - Main Card */}
      <Card className="border border-green-500/20 bg-gradient-to-r from-green-500/5 to-transparent">
        <CardHeader>
          <CardTitle className="text-white">📤 دفع التغييرات</CardTitle>
          <CardDescription>
            {linkedRepo?.status === "linked" 
              ? `المستودع المربوط: ${linkedRepo.owner}/${linkedRepo.repo}` 
              : "لم يتم ربط أي مستودع بعد - اختر واحد أدناه"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Row 1: Repository, Branch, and Link Button */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
            {/* Repository Selection */}
            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider" htmlFor="repo-select">
                المستودع
              </label>
              {loadingRepos ? (
                <div className="flex items-center justify-center h-8 bg-gray-900 border border-gray-700 rounded">
                  <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
                </div>
              ) : (
                <select
                  id="repo-select"
                  data-testid="select-repo"
                  value={selectedRepo}
                  onChange={(e) => setSelectedRepo(e.target.value)}
                  className="w-full h-8 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white hover:border-gray-600 focus:border-blue-500 focus:outline-none transition-colors"
                >
                  <option value="">-- اختر مستودع --</option>
                  {repos.map((repo) => (
                    <option key={`${repo.owner}/${repo.name}`} value={`${repo.owner}/${repo.name}`}>
                      {repo.owner}/{repo.name} {repo.private ? "🔒" : "🌐"}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Branch Selection - Very Small */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider" htmlFor="branch-select">
                الفرع
              </label>
              <select
                id="branch-select"
                data-testid="select-branch"
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="w-full h-8 bg-gray-900 border border-gray-700 rounded px-1.5 py-0.5 text-xs text-white hover:border-gray-600 focus:border-blue-500 focus:outline-none transition-colors font-mono"
              >
                {branches.map((branch) => (
                  <option key={branch} value={branch} className="bg-gray-900 text-white">
                    {branch}
                  </option>
                ))}
              </select>
            </div>

            {/* Link/Unlink Button */}
            <div>
              {linkedRepo?.status === "linked" ? (
                <Button
                  onClick={handleUnlinkRepo}
                  disabled={linkingLoading}
                  size="sm"
                  className="w-full h-8 bg-red-600/80 hover:bg-red-600 text-white border border-red-500/50 text-xs"
                  data-testid="button-unlink-repo"
                >
                  {linkingLoading ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      <span>جاري</span>
                    </>
                  ) : (
                    <>
                      <Unlink2 className="w-3 h-3 mr-1" />
                      <span>إلغاء</span>
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={handleLinkRepo}
                  disabled={linkingLoading || !selectedRepo}
                  size="sm"
                  className="w-full h-8 bg-emerald-600/80 hover:bg-emerald-600 text-white border border-emerald-500/50 text-xs"
                  data-testid="button-link-repo"
                >
                  {linkingLoading ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      <span>جاري</span>
                    </>
                  ) : (
                    <>
                      <Link2 className="w-3 h-3 mr-1" />
                      <span>ربط</span>
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Row 2: Push Button with Toggle */}
          <div className="flex gap-2 items-center">
            <Button
              onClick={() => setShowCommitForm(!showCommitForm)}
              className="flex-1 h-10 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium border border-blue-500/50 transition-all justify-between"
              data-testid="button-toggle-commit"
            >
              <span className="flex-1">📤 دفع التغييرات</span>
              {showCommitForm ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </Button>
          </div>

          {/* Row 3: Commit Message Form (Conditional) */}
          {showCommitForm && (
            <div className="space-y-3 pt-2 border-t border-gray-700/50">
              <div>
                <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider" htmlFor="commit-msg">
                  رسالة التغيير
                </label>
                <Input
                  id="commit-msg"
                  data-testid="input-commit-message"
                  placeholder="مثال: إضافة ميزة جديدة أو إصلاح خلل..."
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  className="mt-2 h-9 bg-gray-900 border border-gray-700 px-3 py-2 text-sm placeholder:text-gray-600 focus:border-blue-500 focus:outline-none transition-colors"
                />
              </div>

              {/* Final Push Button */}
              <Button
                onClick={handlePush}
                disabled={loading || !selectedRepo || !commitMessage.trim()}
                className="w-full h-10 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-medium border border-green-500/50 transition-all"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    جاري الدفع...
                  </>
                ) : (
                  <>✓ تأكيد الدفع</>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Tips Card */}
      <Card className="border border-gray-700/50 bg-gray-900/30">
        <CardHeader>
          <CardTitle className="text-sm text-white">💡 نصائح سريعة</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-xs text-gray-400">
            <li className="flex gap-2">
              <span className="text-blue-400">•</span>
              <span>ربط المستودع مرة واحدة لتبقى الاختيارات محفوظة</span>
            </li>
            <li className="flex gap-2">
              <span className="text-green-400">•</span>
              <span>اختر الفرع المطلوب قبل دفع التغييرات</span>
            </li>
            <li className="flex gap-2">
              <span className="text-yellow-400">•</span>
              <span>اكتب رسالة واضحة وموجزة للتغييرات</span>
            </li>
            <li className="flex gap-2">
              <span className="text-purple-400">•</span>
              <span>يتم دفع التغييرات مباشرة إلى الفرع المحدد</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
