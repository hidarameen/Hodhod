import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle, AlertCircle, Github, Link2, Unlink2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

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
  const [linkedRepo, setLinkedRepo] = useState<any>(null);
  const [loadingLinked, setLoadingLinked] = useState(true);
  const [linkingLoading, setLinkingLoading] = useState(false);
  const [showCommitForm, setShowCommitForm] = useState(false);

  useEffect(() => {
    loadGitHubInfo();
    loadLinkedRepo();
  }, []);

  const loadLinkedRepo = async () => {
    try {
      const res = await fetch("/api/github/linked-repo");
      const data = await res.json();
      setLinkedRepo(data);
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
      setSelectedRepo("");
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

    if (!linkedRepo) {
      toast.error("لا يوجد مستودع مربوط");
      return;
    }

    setLoading(true);
    try {
      const repoValue = `${linkedRepo.owner}/${linkedRepo.repo}`;

      if (!repoValue || !repoValue.includes("/")) {
        toast.error("بيانات المستودع غير صحيحة");
        setLoading(false);
        return;
      }
      
      const parts = repoValue.split("/");
      let owner = parts[0]?.trim();
      let repo = parts[1]?.trim();
      
      if (!owner || owner === "undefined" || !repo || repo === "undefined") {
        toast.error("بيانات المستودع غير صحيحة");
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

  const isLinked = linkedRepo?.status === "linked";

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

      {/* Status and Connection Card */}
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
            <div className="space-y-4">
              {/* Username Section */}
              <div className="space-y-2">
                <p className="text-xs text-gray-400 uppercase tracking-wider">اسم المستخدم</p>
                <p className="text-sm font-mono bg-gray-900/50 px-3 py-2 rounded border border-gray-700">
                  {info.owner}
                </p>
              </div>

              {/* Repository Selection / Status */}
              {!isLinked ? (
                <motion.div 
                  className="space-y-3"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <label className="text-sm font-semibold text-gray-300">المستودع</label>
                  <Select value={selectedRepo} onValueChange={setSelectedRepo} disabled={loadingRepos}>
                    <SelectTrigger className="bg-gray-900 border border-gray-700" data-testid="select-repo">
                      <SelectValue placeholder="-- اختر مستودع --" />
                    </SelectTrigger>
                    <SelectContent>
                      {repos.length === 0 ? (
                        <div className="px-2 py-1.5 text-xs text-muted-foreground">لا توجد مستودعات متاحة</div>
                      ) : (
                        repos.map((repo) => (
                          <SelectItem key={`${repo.owner}/${repo.name}`} value={`${repo.owner}/${repo.name}`}>
                            <div className="flex items-center gap-2">
                              <span>{repo.owner}/{repo.name}</span>
                              <span className="text-xs">{repo.private ? "🔒" : "🌐"}</span>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>

                  <Button
                    onClick={handleLinkRepo}
                    disabled={linkingLoading || !selectedRepo}
                    size="sm"
                    className="w-full bg-emerald-600/80 hover:bg-emerald-600 text-white"
                    data-testid="button-link-repo"
                  >
                    {linkingLoading ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                        جاري...
                      </>
                    ) : (
                      <>
                        <Link2 className="w-3 h-3 mr-2" />
                        ربط المستودع
                      </>
                    )}
                  </Button>
                </motion.div>
              ) : (
                <motion.div 
                  className="flex items-center justify-between gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/30"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <div>
                      <p className="text-xs text-green-400">المستودع المربوط</p>
                      <p className="text-sm text-green-300 font-mono font-bold">{linkedRepo.owner}/{linkedRepo.repo}</p>
                    </div>
                  </div>
                  <Button
                    onClick={handleUnlinkRepo}
                    disabled={linkingLoading}
                    size="sm"
                    variant="ghost"
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-auto"
                    data-testid="button-unlink-repo"
                  >
                    {linkingLoading ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <>
                        <Unlink2 className="w-3 h-3 mr-1" />
                        قطع
                      </>
                    )}
                  </Button>
                </motion.div>
              )}
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

      {/* Push to GitHub - Main Card */}
      {isLinked && (
        <Card className="border border-green-500/20 bg-gradient-to-r from-green-500/5 to-transparent">
          <CardHeader>
            <CardTitle className="text-white">📤 دفع التغييرات</CardTitle>
            <CardDescription>
              المستودع المربوط: {linkedRepo.owner}/{linkedRepo.repo}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Branch Selection */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-300">الفرع</label>
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger className="bg-gray-900 border border-gray-700" data-testid="select-branch">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch} value={branch}>
                      {branch}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Push Button */}
            <Button
              onClick={() => setShowCommitForm(!showCommitForm)}
              className="w-full h-10 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium border border-blue-500/50 justify-between"
              data-testid="button-toggle-commit"
            >
              <span className="flex-1">📤 دفع التغييرات</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showCommitForm ? 'rotate-180' : ''}`} />
            </Button>

            {/* Commit Form */}
            {showCommitForm && (
              <motion.div 
                className="space-y-3 pt-3 border-t border-gray-700/50"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                <div>
                  <label className="text-sm font-semibold text-gray-300">رسالة التغيير</label>
                  <Input
                    placeholder="مثال: إضافة ميزة جديدة أو إصلاح خلل..."
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    className="mt-2 bg-gray-900 border border-gray-700"
                    data-testid="input-commit-message"
                  />
                </div>

                <Button
                  onClick={handlePush}
                  disabled={loading || !commitMessage.trim()}
                  className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-medium border border-green-500/50"
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
              </motion.div>
            )}
          </CardContent>
        </Card>
      )}

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
              <span>بعد الربط، لا يمكن تغيير المستودع إلا بقطع الاتصال أولاً</span>
            </li>
            <li className="flex gap-2">
              <span className="text-yellow-400">•</span>
              <span>اختر الفرع المطلوب قبل دفع التغييرات</span>
            </li>
            <li className="flex gap-2">
              <span className="text-purple-400">•</span>
              <span>اكتب رسالة واضحة وموجزة للتغييرات</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
