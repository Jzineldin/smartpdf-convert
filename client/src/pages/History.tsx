import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  FileSpreadsheet, 
  ArrowLeft, 
  Download, 
  Calendar, 
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from 'sonner';

export default function History() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, loading: authLoading } = useSupabaseAuth();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { data: conversions, isLoading, refetch } = trpc.conversion.history.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  const deleteMutation = trpc.conversion.delete.useMutation({
    onSuccess: () => {
      toast.success('Conversion deleted');
      refetch();
    },
    onError: () => {
      toast.error('Failed to delete conversion');
    }
  });

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    await deleteMutation.mutateAsync({ id });
    setDeletingId(null);
  };

  // Redirect to login if not authenticated
  if (!authLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="py-8 text-center">
            <FileSpreadsheet className="h-12 w-12 mx-auto text-blue-600 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Sign in to view history</h2>
            <p className="text-muted-foreground mb-6">
              You need to be logged in to view your conversion history.
            </p>
            <Button onClick={() => setLocation('/login')}>
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge variant="default" className="gap-1 bg-green-600">
            <CheckCircle className="h-3 w-3" />
            Completed
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Failed
          </Badge>
        );
      case 'processing':
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3 animate-spin" />
            Processing
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1">
            {status}
          </Badge>
        );
    }
  };

  const getConfidenceBadge = (confidence: number | null) => {
    if (confidence === null) return null;
    const percent = Math.round(confidence * 100);
    
    if (percent >= 90) {
      return <Badge variant="default" className="bg-green-600">{percent}%</Badge>;
    } else if (percent >= 70) {
      return <Badge variant="secondary">{percent}%</Badge>;
    } else {
      return (
        <Badge variant="outline" className="text-yellow-600 border-yellow-600 gap-1">
          <AlertTriangle className="h-3 w-3" />
          {percent}%
        </Badge>
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b">
        <div className="container py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-blue-600" />
            <span className="font-bold text-lg"><span className="text-blue-600">XL</span>ify</span>
          </Link>
          
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => setLocation('/dashboard')}>
              Dashboard
            </Button>
            <Button onClick={() => setLocation('/convert')}>
              New Conversion
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-8">
        <div className="mb-6">
          <Link href="/dashboard" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Dashboard
          </Link>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Conversion History</h1>
            <p className="text-muted-foreground">
              View and download your past conversions
            </p>
          </div>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="py-4">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-8 w-24" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && (!conversions || conversions.length === 0) && (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No conversions yet</h3>
              <p className="text-muted-foreground mb-6">
                Start by converting your first PDF to Excel
              </p>
              <Button onClick={() => setLocation('/convert')}>
                Convert a File
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Conversion list */}
        {!isLoading && conversions && conversions.length > 0 && (
          <div className="space-y-4">
            {conversions.map((conversion) => (
              <Card key={conversion.id} className="hover:shadow-md transition-shadow">
                <CardContent className="py-4">
                  <div className="flex items-center gap-4">
                    {/* File icon */}
                    <div className="h-12 w-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileSpreadsheet className="h-6 w-6 text-blue-600" />
                    </div>

                    {/* File info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium truncate">
                          {conversion.originalFilename || 'Untitled'}
                        </h3>
                        {getStatusBadge(conversion.status)}
                        {getConfidenceBadge(conversion.aiConfidenceScore ? Number(conversion.aiConfidenceScore) : null)}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(conversion.createdAt), 'MMM d, yyyy h:mm a')}
                        </span>
                        {conversion.pageCount && conversion.pageCount > 1 && (
                          <span className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {conversion.pageCount} pages
                          </span>
                        )}
                        {conversion.tableCount && (
                          <span>
                            {conversion.tableCount} table{conversion.tableCount > 1 ? 's' : ''} extracted
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {conversion.status === 'completed' && conversion.xlsxStoragePath && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(conversion.xlsxStoragePath!, '_blank')}
                          className="gap-2"
                        >
                          <Download className="h-4 w-4" />
                          Download
                        </Button>
                      )}
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            disabled={deletingId === conversion.id}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete conversion?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete this conversion and its associated files.
                              This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(conversion.id)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
