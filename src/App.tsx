import React, { useState, useEffect, useMemo } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { auth, db, signInWithGoogle, logOut } from './firebase';
import { Search, Plus, Edit2, Trash2, LogOut, Globe, FlaskConical, AlertCircle } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface Reagent {
  id: string;
  nameZh: string;
  nameEn: string;
  cas: string;
  specification: string;
  purity: string;
  brand: string;
  stock: string;
  location: string;
  manager: string;
  updatedAt: number;
  updatedBy: string;
}

// --- i18n ---
const translations = {
  en: {
    title: 'Food Microbiome Reagent Management System',
    searchPlaceholder: 'Search by Name or CAS...',
    addReagent: 'Add Reagent',
    login: 'Login with Google',
    logout: 'Logout',
    nameZh: 'Chinese Name',
    nameEn: 'English Name',
    cas: 'CAS Number',
    specification: 'Specification',
    purity: 'Purity',
    brand: 'Brand',
    stock: 'Current Stock',
    location: 'Storage Location',
    manager: 'Manager',
    actions: 'Actions',
    edit: 'Edit',
    delete: 'Delete',
    save: 'Save',
    cancel: 'Cancel',
    confirmDelete: 'Are you sure you want to delete this reagent?',
    noResults: 'No reagents found.',
    loading: 'Loading...',
    requireLogin: 'Please login to view and manage reagents.',
    addTitle: 'Add New Reagent',
    editTitle: 'Edit Reagent',
  },
  zh: {
    title: '食品微生物组试剂管理系统',
    searchPlaceholder: '输入试剂名称或CAS号检索...',
    addReagent: '添加试剂',
    login: '使用 Google 登录',
    logout: '退出登录',
    nameZh: '中文名称',
    nameEn: '英文名称',
    cas: 'CAS号',
    specification: '规格',
    purity: '纯度',
    brand: '品牌',
    stock: '现存量',
    location: '储存位置',
    manager: '管理人',
    actions: '操作',
    edit: '编辑',
    delete: '删除',
    save: '保存',
    cancel: '取消',
    confirmDelete: '确定要删除该试剂吗？',
    noResults: '未找到相关试剂。',
    loading: '加载中...',
    requireLogin: '请登录以查看和管理试剂。',
    addTitle: '添加新试剂',
    editTitle: '编辑试剂',
  }
};

type Lang = 'en' | 'zh';

// --- Error Handling ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null, setErrorMessage: (msg: string) => void) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  setErrorMessage(errInfo.error);
}

// --- Main Component ---
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [lang, setLang] = useState<Lang>('zh');
  const t = translations[lang];

  const [reagents, setReagents] = useState<Reagent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReagent, setEditingReagent] = useState<Reagent | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Data Fetching
  useEffect(() => {
    const q = query(collection(db, 'reagents'), orderBy('updatedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Reagent[];
      setReagents(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'reagents', setErrorMessage);
    });

    return () => unsubscribe();
  }, []);

  const filteredReagents = useMemo(() => {
    if (!searchQuery.trim()) return reagents;
    const lowerQuery = searchQuery.toLowerCase();
    return reagents.filter(r => 
      r.nameZh.toLowerCase().includes(lowerQuery) || 
      r.nameEn.toLowerCase().includes(lowerQuery) || 
      r.cas.toLowerCase().includes(lowerQuery)
    );
  }, [reagents, searchQuery]);

  const handleDelete = async () => {
    if (!deletingId) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'reagents', deletingId));
      setDeletingId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `reagents/${deletingId}`, setErrorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  const openAddModal = () => {
    setEditingReagent(null);
    setIsModalOpen(true);
  };

  const openEditModal = (reagent: Reagent) => {
    setEditingReagent(reagent);
    setIsModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600">
              <FlaskConical size={24} />
            </div>
            <h1 className="text-lg sm:text-xl font-semibold text-gray-800 hidden sm:block">
              {t.title}
            </h1>
            <h1 className="text-lg font-semibold text-gray-800 sm:hidden">
              {lang === 'zh' ? '试剂管理' : 'Reagents'}
            </h1>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
            <button 
              onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors flex items-center gap-1"
              title="Toggle Language"
            >
              <Globe size={20} />
              <span className="text-sm font-medium uppercase">{lang}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mb-6">
              <div className="relative w-full sm:max-w-md">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm transition-shadow"
                  placeholder={t.searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button
                onClick={openAddModal}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow-sm"
              >
                <Plus size={20} />
                {t.addReagent}
              </button>
            </div>

            {/* Reagent List */}
            {filteredReagents.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center text-gray-500">
                {t.noResults}
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden lg:block bg-white shadow-sm border border-gray-200 rounded-2xl overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.nameZh} / {t.nameEn}</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.cas}</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.specification}</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.purity}</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.brand}</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.stock}</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.location}</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.manager}</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t.actions}</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredReagents.map((reagent) => (
                        <tr key={reagent.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            <div className="flex flex-col">
                              <span>{reagent.nameZh}</span>
                              <span className="text-xs text-gray-400 font-normal">{reagent.nameEn}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{reagent.cas || '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{reagent.specification}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{reagent.purity}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{reagent.brand}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">{reagent.stock}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{reagent.location}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{reagent.manager}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button onClick={() => openEditModal(reagent)} className="text-indigo-600 hover:text-indigo-900 mr-4 p-1 rounded hover:bg-indigo-50 transition-colors" title={t.edit}>
                              <Edit2 size={18} />
                            </button>
                            <button onClick={() => setDeletingId(reagent.id)} className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50 transition-colors" title={t.delete}>
                              <Trash2 size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile/Tablet Card View */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:hidden">
                  {filteredReagents.map((reagent) => (
                    <div key={reagent.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 leading-tight">{reagent.nameZh}</h3>
                          <p className="text-sm text-gray-500 italic leading-tight">{reagent.nameEn}</p>
                          <p className="text-sm text-gray-500 font-mono mt-1">{t.cas}: {reagent.cas || '-'}</p>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => openEditModal(reagent)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                            <Edit2 size={18} />
                          </button>
                          <button onClick={() => setDeletingId(reagent.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm mt-4">
                        <div>
                          <span className="block text-xs text-gray-400 uppercase tracking-wider">{t.stock}</span>
                          <span className="font-medium text-gray-900">{reagent.stock}</span>
                        </div>
                        <div>
                          <span className="block text-xs text-gray-400 uppercase tracking-wider">{t.location}</span>
                          <span className="text-gray-700">{reagent.location}</span>
                        </div>
                        <div>
                          <span className="block text-xs text-gray-400 uppercase tracking-wider">{t.brand}</span>
                          <span className="text-gray-700">{reagent.brand}</span>
                        </div>
                        <div>
                          <span className="block text-xs text-gray-400 uppercase tracking-wider">{t.purity}</span>
                          <span className="text-gray-700">{reagent.purity}</span>
                        </div>
                        <div>
                          <span className="block text-xs text-gray-400 uppercase tracking-wider">{t.specification}</span>
                          <span className="text-gray-700">{reagent.specification}</span>
                        </div>
                        <div>
                          <span className="block text-xs text-gray-400 uppercase tracking-wider">{t.manager}</span>
                          <span className="text-gray-700">{reagent.manager}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
      </main>

      {/* Modal */}
      {isModalOpen && (
        <ReagentModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          reagent={editingReagent} 
          t={t} 
          user={user}
          setErrorMessage={setErrorMessage}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden p-6">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <AlertCircle size={24} />
              <h2 className="text-lg font-semibold">{lang === 'zh' ? '确认删除' : 'Confirm Delete'}</h2>
            </div>
            <p className="text-gray-500 mb-6">{t.confirmDelete}</p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setDeletingId(null)} 
                disabled={isDeleting}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors disabled:opacity-50"
              >
                {t.cancel}
              </button>
              <button 
                onClick={handleDelete} 
                disabled={isDeleting}
                className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isDeleting ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : null}
                {t.delete}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Modal */}
      {errorMessage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden p-6">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <AlertCircle size={24} />
              <h2 className="text-lg font-semibold">{lang === 'zh' ? '发生错误' : 'Error Occurred'}</h2>
            </div>
            <p className="text-gray-500 mb-6 whitespace-pre-wrap">{errorMessage}</p>
            <div className="flex justify-end">
              <button 
                onClick={() => setErrorMessage(null)} 
                className="px-4 py-2 text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 font-medium transition-colors"
              >
                {lang === 'zh' ? '确定' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Modal Component ---
function ReagentModal({ 
  isOpen, 
  onClose, 
  reagent, 
  t,
  user,
  setErrorMessage
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  reagent: Reagent | null; 
  t: any;
  user: User | null;
  setErrorMessage: (msg: string) => void;
}) {
  const [formData, setFormData] = useState({
    nameZh: reagent?.nameZh || '',
    nameEn: reagent?.nameEn || '',
    cas: reagent?.cas || '',
    specification: reagent?.specification || '',
    purity: reagent?.purity || '',
    brand: reagent?.brand || '',
    stock: reagent?.stock || '',
    location: reagent?.location || '',
    manager: reagent?.manager || '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const payload = {
        ...formData,
        updatedAt: Date.now(),
        updatedBy: user?.uid || 'guest'
      };

      if (reagent) {
        await updateDoc(doc(db, 'reagents', reagent.id), payload);
      } else {
        await addDoc(collection(db, 'reagents'), payload);
      }
      onClose();
    } catch (error) {
      handleFirestoreError(error, reagent ? OperationType.UPDATE : OperationType.CREATE, reagent ? `reagents/${reagent.id}` : 'reagents', setErrorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">
            {reagent ? t.editTitle : t.addTitle}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 transition-colors">
            ✕
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto">
          <form id="reagent-form" onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.nameZh}</label>
              <input type="text" name="nameZh" value={formData.nameZh} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-shadow" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.nameEn}</label>
              <input type="text" name="nameEn" value={formData.nameEn} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-shadow" />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.cas}</label>
              <input type="text" name="cas" value={formData.cas} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-shadow" />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.stock}</label>
              <input type="text" name="stock" value={formData.stock} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-shadow" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.specification}</label>
              <input type="text" name="specification" value={formData.specification} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-shadow" />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.purity}</label>
              <input type="text" name="purity" value={formData.purity} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-shadow" />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.brand}</label>
              <input type="text" name="brand" value={formData.brand} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-shadow" />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.location}</label>
              <input type="text" name="location" value={formData.location} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-shadow" />
            </div>
            
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.manager}</label>
              <input type="text" name="manager" value={formData.manager} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-shadow" />
            </div>
          </form>
        </div>
        
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors">
            {t.cancel}
          </button>
          <button type="submit" form="reagent-form" disabled={isSubmitting} className="px-4 py-2 text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
            {isSubmitting ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : null}
            {t.save}
          </button>
        </div>
      </div>
    </div>
  );
}
